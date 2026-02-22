-- M-8: Add missing indexes on frequently queried foreign key columns
CREATE INDEX IF NOT EXISTS idx_contact_notes_subject_person ON public.contact_notes(subject_person_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_group ON public.contact_notes(group_id);
CREATE INDEX IF NOT EXISTS idx_interventions_subject_person ON public.interventions(subject_person_id);
CREATE INDEX IF NOT EXISTS idx_interventions_group ON public.interventions(group_id);
CREATE INDEX IF NOT EXISTS idx_agreements_subject_person ON public.agreements(subject_person_id);
CREATE INDEX IF NOT EXISTS idx_agreements_group ON public.agreements(group_id);
CREATE INDEX IF NOT EXISTS idx_contradictions_subject_person ON public.contradictions(subject_person_id);
CREATE INDEX IF NOT EXISTS idx_alerts_subject_person ON public.alerts(subject_person_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_user ON public.group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_persons_user ON public.persons(user_id);
CREATE INDEX IF NOT EXISTS idx_agreement_versions_agreement ON public.agreement_versions(agreement_id);

-- M-9: Prevent linking a group member (coordinator/supporter) as a supported person
CREATE OR REPLACE FUNCTION public.upsert_supported_person_link(
  p_group_id uuid,
  p_person_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _person_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_group_coordinator(_uid, p_group_id) THEN
    RAISE EXCEPTION 'Only coordinators can link supported persons';
  END IF;

  -- Verify person belongs to this group
  IF NOT EXISTS (
    SELECT 1 FROM public.persons WHERE id = p_person_id AND group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'Person not found in this group';
  END IF;

  -- Check if this user is already linked to another person in this group
  IF EXISTS (
    SELECT 1 FROM public.persons
    WHERE group_id = p_group_id AND user_id = p_user_id AND id != p_person_id
  ) THEN
    RAISE EXCEPTION 'This user is already linked to another person in this group';
  END IF;

  -- M-9 NEW: Prevent linking a user who is a coordinator/supporter in this group
  IF EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_id = p_group_id AND user_id = p_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Cannot link a team member as a supported person. Remove their membership first.';
  END IF;

  -- Link the user to the person
  UPDATE public.persons
  SET user_id = p_user_id, is_primary = true
  WHERE id = p_person_id AND group_id = p_group_id
  RETURNING id INTO _person_id;

  -- Create baseline consent if none exists
  IF NOT EXISTS (
    SELECT 1 FROM public.person_consents
    WHERE group_id = p_group_id AND subject_person_id = p_person_id
  ) THEN
    INSERT INTO public.person_consents (group_id, subject_person_id, created_by_user_id, consent_scope)
    VALUES (p_group_id, _person_id, _uid, 'shared_notes_and_agreements_only');
  END IF;

  RETURN _person_id;
END;
$function$;