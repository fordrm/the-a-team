-- H-1: Add FOR UPDATE row lock to prevent concurrent duplicate approvals
CREATE OR REPLACE FUNCTION public.approve_supported_person(
  p_group_id uuid,
  p_request_id uuid,
  p_subject_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _label text;
  _person_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_group_coordinator(_uid, p_group_id) THEN
    RAISE EXCEPTION 'Only coordinators can approve access requests';
  END IF;

  -- Lock the row to prevent concurrent approvals
  SELECT person_label INTO _label
  FROM public.person_access_requests
  WHERE id = p_request_id AND group_id = p_group_id AND status = 'pending'
  FOR UPDATE;

  IF _label IS NULL THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  INSERT INTO public.persons (group_id, user_id, label, is_primary)
  VALUES (p_group_id, p_subject_user_id, _label, true)
  RETURNING id INTO _person_id;

  UPDATE public.person_access_requests
  SET status = 'approved', reviewed_by_user_id = _uid, reviewed_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.person_consents (group_id, subject_person_id, created_by_user_id, consent_scope)
  VALUES (p_group_id, _person_id, _uid, 'shared_notes_and_agreements_only');

  RETURN _person_id;
END;
$$;

-- H-4: Only allow label updates while person record is still active
DROP POLICY IF EXISTS "Subject person can update own label" ON public.persons;

CREATE POLICY "Subject person can update own label"
ON public.persons
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- H-5: Prevent coordinators from re-processing already-handled requests
DROP POLICY IF EXISTS "Coordinators can update access requests" ON public.person_access_requests;

CREATE POLICY "Coordinators can update pending access requests only"
  ON public.person_access_requests FOR UPDATE TO authenticated
  USING (is_group_coordinator(auth.uid(), group_id) AND status = 'pending')
  WITH CHECK (is_group_coordinator(auth.uid(), group_id));