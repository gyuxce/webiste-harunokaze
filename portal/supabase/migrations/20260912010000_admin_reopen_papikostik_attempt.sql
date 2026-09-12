-- Let an admin reopen a PAPI Kostick attempt that auto-submitted incomplete
-- (participant ran out of time before answering all 90 items). The
-- participant's already-answered questions are preserved in
-- assessment_attempts.answers — we only reopen the session with a fresh
-- deadline and drop the stale, incomplete result so a clean one can be
-- saved once they finish.

drop function if exists public.admin_list_participant_test_progress();

create function public.admin_list_participant_test_progress()
returns table (
  user_id uuid,
  full_name text,
  email text,
  whatsapp text,
  city text,
  payment_status text,
  language_test_status text,
  cfit_test_status text,
  papikostik_test_status text,
  papikostik_is_complete_pattern boolean
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
    progress.papikostik_test_status,
    papi.is_complete_pattern
  from auth.users u
  join public.profiles p on p.id = u.id
  join public.user_progress progress on progress.user_id = u.id
  left join public.papikostik_results papi on papi.user_id = u.id
  where p.role = 'participant'
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_participant_test_progress() from public;
grant execute on function public.admin_list_participant_test_progress() to authenticated;

create or replace function public.admin_reopen_papikostik_attempt(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  progress_row public.user_progress;
  result_row public.papikostik_results;
  attempt_row public.assessment_attempts;
begin
  if not public.is_admin() then
    raise exception 'only an administrator can reopen an assessment attempt';
  end if;

  select * into progress_row from public.user_progress where user_id = p_user_id;
  if progress_row.user_id is null then
    raise exception 'participant progress not found';
  end if;

  if progress_row.papikostik_test_status <> 'completed' then
    raise exception 'papikostik assessment is not completed';
  end if;

  if progress_row.final_review_status not in ('locked', 'pending_psychologist') then
    raise exception 'papikostik review has already progressed and cannot be reopened automatically';
  end if;

  select * into result_row from public.papikostik_results where user_id = p_user_id;
  if result_row.review_status = 'reviewed'
     or result_row.psychologist_notes is not null
     or result_row.final_summary is not null then
    raise exception 'papikostik has already been reviewed and cannot be reopened automatically';
  end if;

  select * into attempt_row
  from public.assessment_attempts
  where user_id = p_user_id and assessment_type = 'papikostik';
  if attempt_row.id is null then
    raise exception 'papikostik assessment attempt not found';
  end if;

  delete from public.papikostik_results where user_id = p_user_id;
  delete from public.psychologist_notification_logs
  where user_id = p_user_id and notification_type = 'papikostik_completed';

  update public.assessment_attempts
  set
    status = 'in_progress',
    deadline_at = now() + (duration_seconds * interval '1 second'),
    completed_at = null,
    timed_out = false,
    last_saved_at = now()
  where user_id = p_user_id and assessment_type = 'papikostik';

  update public.user_progress
  set
    papikostik_test_status = 'in_progress',
    final_review_status = 'locked',
    result_status = 'locked'
  where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_reopen_papikostik_attempt(uuid) from public;
grant execute on function public.admin_reopen_papikostik_attempt(uuid) to authenticated;

notify pgrst, 'reload schema';
