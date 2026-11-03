-- 毎日 00:05 JST に固定費を記録する。pg_cron の時刻は UTC で指定する。
create extension if not exists pg_cron;

select cron.schedule(
  'post-fixed-costs',
  '5 15 * * *',
  $$select public.post_fixed_costs();$$
);
