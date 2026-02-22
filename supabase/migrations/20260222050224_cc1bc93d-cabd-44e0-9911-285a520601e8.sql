-- BUG-2: Fix create_agreement_with_version to set current_version_id
CREATE OR REPLACE FUNCTION public.create_agreement_with_version(
  p_group_id uuid,
  p_subject_person_id uuid,
  p_title text,
  p_body text,
  p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _agreement_id uuid;
  _version_id uuid;
BEGIN
  IF _uid IS NULL OR _uid != p_created_by THEN
    RAISE EXCEPTION 'Not authenticated or mismatched caller';
  END IF;

  IF NOT is_group_member(_uid, p_group_id) THEN
    RAISE EXCEPTION 'Not a group member';
  END IF;

  IF is_subject_person(_uid, p_subject_person_id) THEN
    RAISE EXCEPTION 'Supported persons cannot create agreements';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.persons WHERE id = p_subject_person_id AND group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'Person not found in this group';
  END IF;

  INSERT INTO public.agreements (group_id, subject_person_id, created_by_user_id, status)
  VALUES (p_group_id, p_subject_person_id, _uid, 'proposed')
  RETURNING id INTO _agreement_id;

  INSERT INTO public.agreement_versions (agreement_id, group_id, proposed_by_user_id, version_num, fields)
  VALUES (
    _agreement_id,
    p_group_id,
    _uid,
    1,
    jsonb_build_object('title', p_title, 'body', p_body)
  )
  RETURNING id INTO _version_id;

  UPDATE public.agreements
  SET current_version_id = _version_id
  WHERE id = _agreement_id;

  RETURN _agreement_id;
END;
$function$;

-- Also fix propose_agreement_version to update current_version_id
CREATE OR REPLACE FUNCTION public.propose_agreement_version(
  p_agreement_id uuid,
  p_group_id uuid,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _next_version int;
  _version_id uuid;
  _subject_person_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_group_member(_uid, p_group_id) THEN
    RAISE EXCEPTION 'Not a group member';
  END IF;

  SELECT subject_person_id INTO _subject_person_id
  FROM public.agreements
  WHERE id = p_agreement_id AND group_id = p_group_id;

  IF _subject_person_id IS NULL THEN
    RAISE EXCEPTION 'Agreement not found in this group';
  END IF;

  IF is_subject_person(_uid, _subject_person_id) THEN
    RAISE EXCEPTION 'Supported persons cannot propose versions directly';
  END IF;

  SELECT COALESCE(MAX(version_num), 0) + 1 INTO _next_version
  FROM public.agreement_versions
  WHERE agreement_id = p_agreement_id;

  INSERT INTO public.agreement_versions (agreement_id, group_id, proposed_by_user_id, version_num, fields)
  VALUES (
    p_agreement_id,
    p_group_id,
    _uid,
    _next_version,
    jsonb_build_object('body', p_body)
  )
  RETURNING id INTO _version_id;

  UPDATE public.agreements
  SET current_version_id = _version_id
  WHERE id = p_agreement_id;

  RETURN _version_id;
END;
$function$;

-- Backfill existing agreements missing current_version_id
UPDATE public.agreements a
SET current_version_id = (
  SELECT av.id FROM public.agreement_versions av
  WHERE av.agreement_id = a.id
  ORDER BY av.version_num DESC
  LIMIT 1
)
WHERE a.current_version_id IS NULL;