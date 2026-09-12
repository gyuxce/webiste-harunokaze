-- Admin tooling to unstick a participant whose test is stuck in_progress
-- (crashed device, forgot to finish, ran out of time with unanswered
-- questions, etc.). Lets an admin wipe the stale attempt and reopen the
-- assessment so the participant can start it again from scratch.

create or replace function public.admin_list_participant_test_progress()
returns table (
  user_id uuid,
  full_name text,
  email text,
  whatsapp text,
  city text,
  payment_status text,
  language_test_status text,
  cfit_test_status text,
  papikostik_test_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    u.id,
    coalesce(
      nullif(nullif(trim(p.full_name), ''), 'Peserta'),
      split_part(u.email, '@', 1),
      'Peserta'
    ),
    u.email::text,
    p.whatsapp,
    p.city,
    progress.payment_status,
    progress.language_test_status,
    progress.cfit_test_status,
    progress.papikostik_test_status
  from auth.users u
  join public.profiles p on p.id = u.id
  join public.user_progress progress on progress.user_id = u.id
  where p.role = 'participant'
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_participant_test_progress() from public;
grant execute on function public.admin_list_participant_test_progress() to authenticated;

create or replace function public.admin_reset_assessment_attempt(
  p_user_id uuid,
  p_assessment_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if not public.is_admin() then
    raise exception 'only an administrator can reset an assessment attempt';
  end if;

  if p_assessment_type not in ('pimsleur', 'cfit', 'papikostik') then
    raise exception 'invalid assessment type';
  end if;

  select case p_assessment_type
    when 'pimsleur' then language_test_status
    when 'cfit' then cfit_test_status
    when 'papikostik' then papikostik_test_status
  end
  into current_status
  from public.user_progress
  where user_id = p_user_id;

  if current_status is null then
    raise exception 'participant progress not found';
  end if;

  if current_status <> 'in_progress' then
    raise exception 'assessment is not in progress';
  end if;

  delete from public.assessment_attempts
  where user_id = p_user_id
    and assessment_type = p_assessment_type;

  update public.user_progress
  set
    language_test_status = case
      when p_assessment_type = 'pimsleur' then 'available'
      else language_test_status
    end,
    cfit_test_status = case
      when p_assessment_type = 'cfit' then 'available'
      else cfit_test_status
    end,
    papikostik_test_status = case
      when p_assessment_type = 'papikostik' then 'available'
      else papikostik_test_status
    end
  where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_reset_assessment_attempt(uuid, text) from public;
grant execute on function public.admin_reset_assessment_attempt(uuid, text) to authenticated;

notify pgrst, 'reload schema';
