create or replace function public.bootstrap_create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  _uid uuid := auth.uid();
  _group_id uuid;
begin
  if _uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.groups (name, created_by_user_id)
  values (trim(p_name), _uid)
  returning id into _group_id;

  insert into public.group_memberships (group_id, user_id, role, is_active, capabilities)
  values (_group_id, _uid, 'coordinator', true, '{}'::jsonb);

  return _group_id;
end;
$$;

grant execute on function public.bootstrap_create_group(text) to authenticated;