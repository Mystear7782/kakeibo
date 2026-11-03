-- 家計簿アプリ 初期スキーマ
-- 金額は円の正の整数で保持し、方向は type で表す。
-- 日付の境界は Asia/Tokyo で判定する。

create or replace function public.jst_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Tokyo')::date;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 費目
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('expense', 'income', 'transfer', 'fixed')),
  name text not null check (length(btrim(name)) between 1 and 30),
  sort_order integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, name)
);

-- 固定費
create table public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 50),
  amount integer not null check (amount > 0),
  category_id uuid not null references public.categories (id),
  cycle text not null check (cycle in ('monthly', 'yearly')),
  pay_month smallint check (pay_month between 1 and 12),
  pay_day smallint check (pay_day between 1 and 28),
  is_month_end boolean not null default false,
  payment_method text not null check (payment_method in ('cash', 'card', 'bank')),
  start_month date not null,
  end_month date,
  is_variable boolean not null default false,
  auto_record boolean not null default true,
  -- 登録日より前の支払日は予定にも自動記録にも含めない
  tracking_from date not null default public.jst_today(),
  -- 自動記録の処理済み日。削除した自動記録を再作成しないために持つ
  recorded_through date not null default (public.jst_today() - 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (extract(day from start_month) = 1),
  check (end_month is null or (extract(day from end_month) = 1 and end_month >= start_month)),
  check ((cycle = 'yearly') = (pay_month is not null)),
  check (is_month_end = (pay_day is null))
);

-- 明細
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('expense', 'income', 'transfer')),
  occurred_on date not null,
  amount integer not null check (amount > 0),
  category_id uuid not null references public.categories (id),
  payment_method text not null check (payment_method in ('cash', 'card', 'qr', 'bank')),
  memo text not null default '' check (length(memo) <= 200),
  source text not null default 'manual' check (source in ('manual', 'fixed', 'mcp', 'moneyforward')),
  external_id text,
  fixed_cost_id uuid references public.fixed_costs (id) on delete set null,
  is_estimated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);
create unique index transactions_external_uidx
  on public.transactions (user_id, source, external_id)
  where external_id is not null;
create unique index transactions_fixed_due_uidx
  on public.transactions (fixed_cost_id, occurred_on)
  where fixed_cost_id is not null;

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger fixed_costs_updated_at before update on public.fixed_costs
  for each row execute function public.set_updated_at();
create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- 費目の種類と本人のデータであることをDB側でも保証する
create or replace function public.check_transaction_category()
returns trigger
language plpgsql
as $$
declare
  v_kind text;
begin
  select kind into v_kind
  from public.categories
  where id = new.category_id and user_id = new.user_id;

  if v_kind is null then
    raise exception 'category not found for this user';
  end if;
  if not (
    (new.type = 'expense' and v_kind in ('expense', 'fixed'))
    or (new.type = 'income' and v_kind = 'income')
    or (new.type = 'transfer' and v_kind = 'transfer')
  ) then
    raise exception 'category kind % does not match type %', v_kind, new.type;
  end if;
  return new;
end;
$$;

create trigger transactions_check_category
  before insert or update of type, category_id, user_id on public.transactions
  for each row execute function public.check_transaction_category();

create or replace function public.check_fixed_cost_category()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.categories
    where id = new.category_id and user_id = new.user_id and kind = 'fixed'
  ) then
    raise exception 'fixed cost requires a fixed category of this user';
  end if;
  return new;
end;
$$;

create trigger fixed_costs_check_category
  before insert or update of category_id, user_id on public.fixed_costs
  for each row execute function public.check_fixed_cost_category();

-- RLS
alter table public.categories enable row level security;
alter table public.fixed_costs enable row level security;
alter table public.transactions enable row level security;

create policy categories_owner on public.categories
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy fixed_costs_owner on public.fixed_costs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy transactions_owner on public.transactions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.categories, public.fixed_costs, public.transactions to authenticated;
revoke all on public.categories, public.fixed_costs, public.transactions from anon;

-- 初期費目。何度実行しても重複しない
create or replace function public.seed_default_categories()
returns void
language sql
as $$
  insert into public.categories (kind, name, sort_order)
  select kind, name, sort_order
  from (values
    ('expense', '食費', 10), ('expense', '日用品', 20), ('expense', '交通費', 30),
    ('expense', '交際費', 40), ('expense', '趣味', 50), ('expense', '医療', 60),
    ('expense', '衣服', 70), ('expense', '特別費', 80), ('expense', 'その他', 90),
    ('income', '給与', 10), ('income', '賞与', 20), ('income', '副業', 30),
    ('income', '還付', 40), ('income', 'その他', 50),
    ('transfer', '投資', 10), ('transfer', '貯金', 20),
    ('transfer', '口座間の移動', 30), ('transfer', 'その他', 40),
    ('fixed', '住居', 10), ('fixed', '水道光熱', 20), ('fixed', '通信', 30),
    ('fixed', '保険', 40), ('fixed', 'サブスク', 50), ('fixed', 'ローン', 60),
    ('fixed', '車', 70), ('fixed', 'その他', 80)
  ) as defaults (kind, name, sort_order)
  on conflict (user_id, kind, name) do nothing;
$$;

-- 固定費の支払日を期間内で展開する
create or replace function public.fixed_cost_due_dates(
  p_fixed public.fixed_costs,
  p_from date,
  p_to date
)
returns setof date
language sql
stable
as $$
  select due_on
  from (
    select
      case
        when p_fixed.is_month_end then (month_start + interval '1 month - 1 day')::date
        else month_start::date + (p_fixed.pay_day - 1)
      end as due_on
    from generate_series(
      date_trunc('month', p_from::timestamp),
      date_trunc('month', p_to::timestamp),
      interval '1 month'
    ) as months (month_start)
    where p_fixed.cycle = 'monthly'
      or extract(month from month_start)::smallint = p_fixed.pay_month
  ) as dates
  where due_on between p_from and p_to
    and due_on >= p_fixed.start_month
    and (p_fixed.end_month is null or due_on < p_fixed.end_month + interval '1 month')
  order by due_on;
$$;

-- 支払日を迎えた固定費を明細へ記録する。
-- 停止していた期間の分も recorded_through から追いつく。
create or replace function public.post_fixed_costs(p_today date default public.jst_today())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixed public.fixed_costs;
  v_count integer := 0;
  v_rows integer;
begin
  for v_fixed in
    select * from public.fixed_costs
    where recorded_through < p_today
    for update
  loop
    if v_fixed.auto_record then
      insert into public.transactions (
        user_id, type, occurred_on, amount, category_id, payment_method,
        memo, source, fixed_cost_id, is_estimated
      )
      select
        v_fixed.user_id, 'expense', due_on, v_fixed.amount, v_fixed.category_id,
        v_fixed.payment_method, v_fixed.name, 'fixed', v_fixed.id, v_fixed.is_variable
      from public.fixed_cost_due_dates(v_fixed, v_fixed.recorded_through + 1, p_today) as due_on
      on conflict (fixed_cost_id, occurred_on) where fixed_cost_id is not null do nothing;

      get diagnostics v_rows = row_count;
      v_count := v_count + v_rows;
    end if;

    update public.fixed_costs
    set recorded_through = p_today
    where id = v_fixed.id;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.post_fixed_costs(date) from public, anon, authenticated;

-- カレンダーの予定。明細になっていない固定費だけを返す
create or replace function public.get_month_schedule(p_month date)
returns table (
  due_on date,
  fixed_cost_id uuid,
  name text,
  amount integer,
  payment_method text,
  is_estimated boolean,
  status text
)
language sql
stable
as $$
  with bounds as (
    select
      date_trunc('month', p_month::timestamp)::date as month_from,
      (date_trunc('month', p_month::timestamp) + interval '1 month - 1 day')::date as month_to
  )
  select
    due.due_on,
    f.id,
    f.name,
    f.amount,
    f.payment_method,
    f.is_variable,
    case when due.due_on > public.jst_today() then 'planned' else 'unrecorded' end
  from public.fixed_costs f
  cross join bounds b
  cross join lateral public.fixed_cost_due_dates(f, greatest(b.month_from, f.tracking_from), b.month_to) as due (due_on)
  where not exists (
      select 1 from public.transactions t
      where t.fixed_cost_id = f.id and t.occurred_on = due.due_on
    )
    and not (f.auto_record and due.due_on <= f.recorded_through)
  order by due.due_on, f.name;
$$;

-- 月別の収支。投資と振替は支出に含めず別枠で返す
create or replace function public.get_cashflow_summary(p_from date, p_to date)
returns table (
  month date,
  income bigint,
  expense bigint,
  fixed_expense bigint,
  transfer bigint,
  balance bigint,
  savings_rate numeric
)
language sql
stable
as $$
  with months as (
    select month_start::date as month
    from generate_series(
      date_trunc('month', p_from::timestamp),
      date_trunc('month', p_to::timestamp),
      interval '1 month'
    ) as series (month_start)
  ),
  totals as (
    select
      m.month,
      coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::bigint as income,
      coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::bigint as expense,
      coalesce(sum(t.amount) filter (
        where t.type = 'expense' and (t.fixed_cost_id is not null or c.kind = 'fixed')
      ), 0)::bigint as fixed_expense,
      coalesce(sum(t.amount) filter (where t.type = 'transfer'), 0)::bigint as transfer
    from months m
    left join public.transactions t
      on t.occurred_on >= m.month
      and t.occurred_on < (m.month + interval '1 month')
    left join public.categories c on c.id = t.category_id
    group by m.month
  )
  select
    month, income, expense, fixed_expense, transfer,
    income - expense as balance,
    case when income = 0 then null else round((income - expense)::numeric / income, 4) end
  from totals
  order by month;
$$;

revoke execute on function public.seed_default_categories() from public, anon;
revoke execute on function public.get_month_schedule(date) from public, anon;
revoke execute on function public.get_cashflow_summary(date, date) from public, anon;
grant execute on function public.seed_default_categories() to authenticated;
grant execute on function public.get_month_schedule(date) to authenticated;
grant execute on function public.get_cashflow_summary(date, date) to authenticated;
