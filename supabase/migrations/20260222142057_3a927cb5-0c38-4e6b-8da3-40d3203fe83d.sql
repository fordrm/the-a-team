
-- Drop the old function signature
DROP FUNCTION IF EXISTS public.create_agreement_with_version(uuid, uuid, text, text, uuid);

-- Create updated function accepting full fields JSON
CREATE OR REPLACE FUNCTION public.create_agreement_with_version(
  p_group_id uuid,
  p_subject_person_id uuid,
  p_fields jsonb,
  p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  v_agreement_id uuid;
  v_version_id uuid;
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
  RETURNING id INTO v_agreement_id;

  INSERT INTO public.agreement_versions (agreement_id, group_id, proposed_by_user_id, version_num, fields)
  VALUES (v_agreement_id, p_group_id, _uid, 1, p_fields)
  RETURNING id INTO v_version_id;

  UPDATE public.agreements SET current_version_id = v_version_id WHERE id = v_agreement_id;

  RETURN v_agreement_id;
END;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.create_agreement_with_version(uuid, uuid, jsonb, uuid) TO authenticated;
