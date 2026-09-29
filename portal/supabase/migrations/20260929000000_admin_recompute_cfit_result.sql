-- Admin tooling to correct a participant's birth_date and recompute their
-- CFIT IQ/category/norm/age afterward. Needed because a mistyped birth_date
-- at registration silently produces a null IQ (raw score present, age
-- outside the 13-17+ range the CFIT 3A norm table covers) with no
-- self-service fix path before this — the only option was a manual SQL
-- update. The norm lookup table itself stays in the frontend
-- (src/data/cfitScoring.ts) as the single source of truth; this RPC persists
-- values the client already computed with that same function, it does not
-- duplicate the table in SQL.

create or replace function public.admin_update_participant_birth_date(
  p_user_id uuid,
  p_birth_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only an administrator can update a participant birth date';
  end if;

  if p_birth_date > (current_date - interval '17 years')::date
     or p_birth_date < (current_date - interval '60 years')::date then
    raise exception 'birth date must reflect an age between 17 and 60 years';
  end if;

  update public.profiles
  set birth_date = p_birth_date
  where id = p_user_id
    and role = 'participant';

  if not found then
    raise exception 'participant not found';
  end if;
end;
$$;

revoke all on function public.admin_update_participant_birth_date(uuid, date) from public;
grant execute on function public.admin_update_participant_birth_date(uuid, date) to authenticated;

create or replace function public.admin_recompute_cfit_result(
  p_user_id uuid,
  p_iq integer,
  p_category text,
  p_norm_code text,
  p_age_years integer,
  p_age_months integer
)
returns public.cfit_results
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.cfit_results;
begin
  if not public.is_admin() then
    raise exception 'only an administrator can recompute a CFIT result';
  end if;

  if p_norm_code not in ('A1', 'A2', 'A3', 'A4', 'A5', 'A6') then
    raise exception 'invalid norm code';
  end if;

  update public.cfit_results
  set
    iq = p_iq,
    category = p_category,
    norm_code = p_norm_code,
    age_years = p_age_years,
    age_months = p_age_months
  where user_id = p_user_id
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'cfit result not found for participant';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.admin_recompute_cfit_result(uuid, integer, text, text, integer, integer) from public;
grant execute on function public.admin_recompute_cfit_result(uuid, integer, text, text, integer, integer) to authenticated;

notify pgrst, 'reload schema';
