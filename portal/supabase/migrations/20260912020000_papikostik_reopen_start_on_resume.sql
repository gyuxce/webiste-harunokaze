-- Make a reopened PAPI Kostick attempt start its fresh deadline when the
-- participant actually opens the test again, not the moment the admin
-- clicks "Lanjutkan tes". Otherwise the clock burns down while the admin
-- and participant are still coordinating over WhatsApp/etc.
--
-- Approach: admin_reopen_papikostik_attempt only flags the attempt as
-- pending_admin_reopen. start_assessment_attempt (called by the
-- participant's own browser when the test page loads) consumes that flag
-- exactly once, computing the real deadline_at at that moment, then clears
-- the flag so later page refreshes behave like a normal resume (no more
-- timer resets).

alter table public.assessment_attempts
  add column if not exists pending_admin_reopen boolean not null default false;

create or replace function public.start_assessment_attempt(
  p_assessment_type text,
  p_duration_seconds integer,
  p_step_duration_seconds integer default null
)
returns table (
  id uuid,
  assessment_type text,
  status text,
  duration_seconds integer,
  started_at timestamptz,
  deadline_at timestamptz,
  step_started_at timestamptz,
  step_deadline_at timestamptz,
  current_step integer,
  answers jsonb,
  last_saved_at timestamptz,
  completed_at timestamptz,
  timed_out boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_attempt public.assessment_attempts;
  created_attempt public.assessment_attempts;
  now_at timestamptz := now();
  first_step_deadline timestamptz;
  expected_duration integer;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_assessment_type not in ('pimsleur', 'cfit', 'papikostik') then
    raise exception 'invalid assessment type';
  end if;

  expected_duration := case p_assessment_type
    when 'pimsleur' then 30 * 60
    when 'cfit' then (7 * 60) + (8 * 60) + (7 * 60) + (6 * 60) + 30
    when 'papikostik' then 20 * 60
  end;

  if p_duration_seconds is null or p_duration_seconds <> expected_duration then
    raise exception 'invalid assessment duration';
  end if;

  if p_step_duration_seconds is not null
     and (p_step_duration_seconds < 30 or p_step_duration_seconds > p_duration_seconds) then
    raise exception 'invalid step duration';
  end if;

  if p_assessment_type <> 'cfit' and p_step_duration_seconds is not null then
    raise exception 'step duration is only supported for cfit';
  end if;

  if p_assessment_type = 'cfit'
     and p_step_duration_seconds is distinct from (7 * 60) then
    raise exception 'invalid initial cfit step duration';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = current_user_id
      and profiles.role = 'participant'
  ) then
    raise exception 'participant not found';
  end if;

  if p_assessment_type = 'pimsleur' and not exists (
    select 1
    from public.user_progress
    where user_progress.user_id = current_user_id
      and user_progress.payment_status in ('paid', 'verified')
      and user_progress.language_test_status <> 'completed'
  ) then
    raise exception 'pimsleur assessment is not available';
  end if;

  if p_assessment_type = 'cfit' and not exists (
    select 1
    from public.user_progress
    where user_progress.user_id = current_user_id
      and user_progress.language_test_status = 'completed'
      and user_progress.cfit_test_status <> 'completed'
  ) then
    raise exception 'cfit assessment is not available';
  end if;

  if p_assessment_type = 'papikostik' and not exists (
    select 1
    from public.user_progress
    where user_progress.user_id = current_user_id
      and user_progress.cfit_test_status = 'completed'
      and user_progress.papikostik_test_status <> 'completed'
  ) then
    raise exception 'papikostik assessment is not available';
  end if;

  select *
  into existing_attempt
  from public.assessment_attempts
  where assessment_attempts.user_id = current_user_id
    and assessment_attempts.assessment_type = p_assessment_type
  for update;

  if existing_attempt.id is null then
    first_step_deadline := case
      when p_step_duration_seconds is null then null
      else least(
        now_at + (p_duration_seconds * interval '1 second'),
        now_at + (p_step_duration_seconds * interval '1 second')
      )
    end;

    insert into public.assessment_attempts (
      user_id,
      assessment_type,
      duration_seconds,
      started_at,
      deadline_at,
      step_started_at,
      step_deadline_at
    )
    values (
      current_user_id,
      p_assessment_type,
      p_duration_seconds,
      now_at,
      now_at + (p_duration_seconds * interval '1 second'),
      now_at,
      first_step_deadline
    )
    on conflict on constraint assessment_attempts_user_type_unique do nothing
    returning * into created_attempt;

    if created_attempt.id is null then
      select *
      into existing_attempt
      from public.assessment_attempts
      where assessment_attempts.user_id = current_user_id
        and assessment_attempts.assessment_type = p_assessment_type
      for update;
    else
      existing_attempt := created_attempt;
    end if;
  elsif existing_attempt.pending_admin_reopen then
    update public.assessment_attempts as attempt
    set
      started_at = now_at,
      deadline_at = now_at + (p_duration_seconds * interval '1 second'),
      step_started_at = now_at,
      pending_admin_reopen = false,
      last_saved_at = now_at
    where attempt.id = existing_attempt.id
    returning * into existing_attempt;
  end if;

  return query
  select
    existing_attempt.id,
    existing_attempt.assessment_type,
    existing_attempt.status,
    existing_attempt.duration_seconds,
    existing_attempt.started_at,
    existing_attempt.deadline_at,
    existing_attempt.step_started_at,
    existing_attempt.step_deadline_at,
    existing_attempt.current_step,
    existing_attempt.answers,
    existing_attempt.last_saved_at,
    existing_attempt.completed_at,
    existing_attempt.timed_out;
end;
$$;

revoke all on function public.start_assessment_attempt(text, integer, integer) from public;
grant execute on function public.start_assessment_attempt(text, integer, integer) to authenticated;

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

  -- Deadline is deliberately NOT set here — start_assessment_attempt sets it
  -- the moment the participant's browser actually reopens the test.
  update public.assessment_attempts
  set
    status = 'in_progress',
    completed_at = null,
    timed_out = false,
    pending_admin_reopen = true,
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
