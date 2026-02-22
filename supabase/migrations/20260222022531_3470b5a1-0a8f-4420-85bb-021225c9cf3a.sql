
-- RPC to cascade-delete a supported person and all related data
-- Coordinator-only, validated inside the function
CREATE OR REPLACE FUNCTION public.delete_supported_person(p_group_id uuid, p_person_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_group_coordinator(_uid, p_group_id) THEN
    RAISE EXCEPTION 'Only coordinators can delete supported persons';
  END IF;

  -- Verify person belongs to this group
  IF NOT EXISTS (
    SELECT 1 FROM public.persons WHERE id = p_person_id AND group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'Person not found in this group';
  END IF;

  -- Delete in dependency order
  DELETE FROM public.intervention_private_details WHERE subject_person_id = p_person_id AND group_id = p_group_id;
  DELETE FROM public.interventions WHERE subject_person_id = p_person_id AND group_id = p_group_id;
  DELETE FROM public.contradictions WHERE subject_person_id = p_person_id AND group_id = p_group_id;
  DELETE FROM public.alerts WHERE subject_person_id = p_person_id AND group_id = p_group_id;
  DELETE FROM public.agreement_acceptances WHERE group_id = p_group_id AND agreement_id IN (
    SELECT id FROM public.agreements WHERE subject_person_id = p_person_id AND group_id = p_group_id
  );
  DELETE FROM public.agreement_versions WHERE group_id = p_group_id AND agreement_id IN (
    SELECT id FROM public.agreements WHERE subject_person_id = p_person_id AND group_id = p_group_id
  );
  DELETE FROM public.agreements WHERE subject_person_id = p_person_id AND group_id = p_group_id;
  DELETE FROM public.contact_notes WHERE subject_person_id = p_person_id AND group_id = p_group_id;
  DELETE FROM public.person_consents WHERE subject_person_id = p_person_id AND group_id = p_group_id;
  DELETE FROM public.persons WHERE id = p_person_id AND group_id = p_group_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_supported_person(uuid, uuid) TO authenticated;
