-- サブスク管理。固定費に印を付け、支払額の集計を返す。
alter table public.fixed_costs
  add column is_subscription boolean not null default false;

-- サブスクの一覧と金額。解約済み(終了月が過ぎたもの)も含めて返す。
-- 年額換算は月払いなら12倍、月額換算は年払いなら12で割って四捨五入する。
-- 支払額は記録済みの明細(fixed_cost_id でひもづくもの)の合計。
create or replace function public.get_subscription_summary(
  p_year integer default extract(year from public.jst_today())::integer
)
returns table (
  fixed_cost_id uuid,
  name text,
  amount integer,
  cycle text,
  payment_method text,
  start_month date,
  end_month date,
  is_cancelled boolean,
  monthly_amount integer,
  yearly_amount integer,
  paid_in_year bigint,
  paid_total bigint
)
language sql
stable
as $$
  select
    f.id,
    f.name,
    f.amount,
    f.cycle,
    f.payment_method,
    f.start_month,
    f.end_month,
    f.end_month is not null
      and (f.end_month + interval '1 month')::date <= public.jst_today() as is_cancelled,
    case when f.cycle = 'monthly' then f.amount else round(f.amount / 12.0)::integer end,
    case when f.cycle = 'monthly' then f.amount * 12 else f.amount end,
    coalesce(sum(t.amount) filter (
      where t.occurred_on >= make_date(p_year, 1, 1)
        and t.occurred_on < make_date(p_year + 1, 1, 1)
    ), 0)::bigint,
    coalesce(sum(t.amount), 0)::bigint
  from public.fixed_costs f
  left join public.transactions t
    on t.fixed_cost_id = f.id and t.type = 'expense'
  where f.is_subscription
  group by f.id
  order by f.name;
$$;

revoke execute on function public.get_subscription_summary(integer) from public, anon;
grant execute on function public.get_subscription_summary(integer) to authenticated;
