
-- Unique constraint on persons(group_id, user_id) where user_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS persons_group_user_unique ON public.persons (group_id, user_id) WHERE user_id IS NOT NULL;

-- RLS: supported person can UPDATE their own persons row (label only)
CREATE POLICY "Subject person can update own label"
ON public.persons
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create upsert_supported_person RPC
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
  _person_id uuid;
BEGIN
  -- Check if person already exists
  SELECT id INTO _person_id
  FROM public.persons
  WHERE group_id = p_group_id AND user_id = p_subject_user_id;

  IF _person_id IS NOT NULL THEN
    RETURN _person_id;
  END IF;

  -- Insert new person
  INSERT INTO public.persons (group_id, user_id, label, is_primary)
  VALUES (p_group_id, p_subject_user_id, p_label, true)
  RETURNING id INTO _person_id;

  -- Create baseline consent
  INSERT INTO public.person_consents (group_id, subject_person_id, created_by_user_id, consent_scope)
  VALUES (p_group_id, _person_id, p_subject_user_id, 'shared_notes_and_agreements_only');

  RETURN _person_id;
END;
$function$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.upsert_supported_person(uuid, uuid, text) TO authenticated;
