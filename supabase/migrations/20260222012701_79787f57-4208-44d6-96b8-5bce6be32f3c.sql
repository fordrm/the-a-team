create or replace function public.whoami()
returns uuid
language sql
stable
security definer
set search_path = 'public'
as $$
  select auth.uid();
$$;

grant execute on function public.whoami() to authenticated;