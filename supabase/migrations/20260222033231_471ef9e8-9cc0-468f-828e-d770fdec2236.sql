-- C-1 FIX: Add authentication and authorization checks to upsert_supported_person()
CREATE OR REPLACE FUNCTION public.upsert_supported_person(
  p_group_id uuid,
  p_subject_user_id uuid,
  p_label text
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
    RAISE EXCEPTION 'Only coordinators can create supported person records';
  END IF;

  SELECT id INTO _person_id
  FROM public.persons
  WHERE group_id = p_group_id AND user_id = p_subject_user_id;

  IF _person_id IS NOT NULL THEN
    RETURN _person_id;
  END IF;

  INSERT INTO public.persons (group_id, user_id, label, is_primary)
  VALUES (p_group_id, p_subject_user_id, p_label, true)
  RETURNING id INTO _person_id;

  INSERT INTO public.person_consents (group_id, subject_person_id, created_by_user_id, consent_scope)
  VALUES (p_group_id, _person_id, _uid, 'shared_notes_and_agreements_only');

  RETURN _person_id;
END;
$function$;