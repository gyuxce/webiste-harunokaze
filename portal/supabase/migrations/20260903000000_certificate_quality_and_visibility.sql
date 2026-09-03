-- Keep incomplete assessment data from being published or exposed as a certificate.

create or replace function public.has_complete_assessment_results(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_progress progress
    join public.pimsleur_results ps on ps.user_id = progress.user_id
    join public.cfit_results cf on cf.user_id = progress.user_id
    join public.papikostik_results pk on pk.user_id = progress.user_id
    where progress.user_id = p_user_id
      and progress.language_test_status = 'completed'
      and progress.cfit_test_status = 'completed'
      and progress.papikostik_test_status = 'completed'
      and ps.score_total is not null
      and cf.raw_total is not null
      and pk.total_all is not null
  );
$$;

revoke all on function public.has_complete_assessment_results(uuid) from public;

drop policy if exists "Users can view own certificates" on public.certificates;
drop policy if exists "Admins can view all certificates" on public.certificates;
create policy "Admins can view all certificates"
  on public.certificates for select
  using (
    public.is_admin()
    or (
      auth.uid() = public.certificates.user_id
      and public.has_complete_assessment_results(public.certificates.user_id)
      and exists (
        select 1
        from public.user_progress progress
        where progress.user_id = public.certificates.user_id
          and progress.result_status = 'completed'
          and progress.final_review_status = 'approved'
      )
    )
  );

create or replace function public.admin_publish_assessment(p_user_id uuid)
returns table (certificate_id uuid, certificate_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  review public.assessment_final_reviews;
  language_score integer;
  generated_code text;
  saved_certificate public.certificates;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into review
  from public.assessment_final_reviews
  where user_id = p_user_id;

  if not found then
    raise exception 'final review has not been created';
  end if;
  if nullif(trim(coalesce(review.psychologist_interpretation, '')), '') is null then
    raise exception 'psychologist interpretation is required';
  end if;
  if nullif(trim(coalesce(review.participant_summary, '')), '') is null then
    raise exception 'participant summary is required';
  end if;
  if not public.has_complete_assessment_results(p_user_id) then
    raise exception 'all assessments must be completed before publishing';
  end if;
  if not exists (
    select 1
    from public.papikostik_results pk
    where pk.user_id = p_user_id
      and pk.review_status = 'reviewed'
      and nullif(trim(coalesce(pk.psychologist_notes, '')), '') is not null
  ) then
    raise exception 'PAPI review must be completed before publishing';
  end if;

  select score_total into language_score
  from public.pimsleur_results
  where user_id = p_user_id;

  generated_code := 'HNZ-' || to_char(now(), 'YYYY') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  select * into saved_certificate
  from public.certificates
  where user_id = p_user_id;

  if found then
    update public.certificates
    set
      score = coalesce(language_score, 0),
      recommendation = review.participant_summary
    where user_id = p_user_id
    returning * into saved_certificate;
  else
    insert into public.certificates (
      user_id,
      certificate_code,
      score,
      recommendation
    )
    values (
      p_user_id,
      generated_code,
      coalesce(language_score, 0),
      review.participant_summary
    )
    returning * into saved_certificate;
  end if;

  update public.assessment_final_reviews
  set
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at = now()
  where user_id = p_user_id;

  update public.user_progress
  set
    final_review_status = 'approved',
    result_status = 'completed',
    updated_at = now()
  where user_id = p_user_id;

  return query select saved_certificate.id, saved_certificate.certificate_code;
end;
$$;

revoke all on function public.admin_publish_assessment(uuid) from public;
grant execute on function public.admin_publish_assessment(uuid) to authenticated;

notify pgrst, 'reload schema';
