
-- Add unique constraint on persons(group_id, user_id) where user_id is not null
-- This prevents the same user being linked to multiple person records in the same group
CREATE UNIQUE INDEX IF NOT EXISTS persons_group_id_user_id_unique 
ON public.persons (group_id, user_id) 
WHERE user_id IS NOT NULL;

-- Allow coordinators to update persons rows (set/clear user_id, update label)
CREATE POLICY "Coordinators can update persons"
ON public.persons
FOR UPDATE
USING (is_group_coordinator(auth.uid(), group_id))
WITH CHECK (is_group_coordinator(auth.uid(), group_id));

-- RPC to link an existing person record to a user
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
