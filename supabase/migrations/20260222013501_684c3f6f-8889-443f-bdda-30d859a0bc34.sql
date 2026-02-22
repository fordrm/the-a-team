-- Phase 3A: person_access_requests table
CREATE TABLE public.person_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  person_label text NOT NULL,
  requester_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by_user_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.person_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requester can insert access requests"
  ON public.person_access_requests FOR INSERT TO authenticated
  WITH CHECK (
    is_group_member(auth.uid(), group_id)
    AND requester_user_id = auth.uid()
  );

CREATE POLICY "Coordinators and requester can select access requests"
  ON public.person_access_requests FOR SELECT TO authenticated
  USING (
    is_group_coordinator(auth.uid(), group_id)
    OR requester_user_id = auth.uid()
  );

CREATE POLICY "Coordinators can update access requests"
  ON public.person_access_requests FOR UPDATE TO authenticated
  USING (is_group_coordinator(auth.uid(), group_id))
  WITH CHECK (is_group_coordinator(auth.uid(), group_id));

-- Phase 3A: person_consents table
CREATE TABLE public.person_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  subject_person_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL,
  consent_scope text NOT NULL DEFAULT 'shared_notes_and_agreements_only',
  consent_notes text,
  effective_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.person_consents ENABLE ROW LEVEL SECURITY;

-- Helper to check if user is the subject person
CREATE OR REPLACE FUNCTION public.is_subject_person(_user_id uuid, _person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.persons
    WHERE id = _person_id AND user_id = _user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_subject_person(uuid, uuid) TO authenticated;

CREATE POLICY "Coordinators and subject person can select consents"
  ON public.person_consents FOR SELECT TO authenticated
  USING (
    is_group_coordinator(auth.uid(), group_id)
    OR is_subject_person(auth.uid(), subject_person_id)
  );

CREATE POLICY "Coordinators can insert consents"
  ON public.person_consents FOR INSERT TO authenticated
  WITH CHECK (
    is_group_coordinator(auth.uid(), group_id)
    AND created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = person_consents.subject_person_id
        AND p.group_id = person_consents.group_id
    )
  );

CREATE POLICY "Coordinators can update consents"
  ON public.person_consents FOR UPDATE TO authenticated
  USING (is_group_coordinator(auth.uid(), group_id))
  WITH CHECK (
    is_group_coordinator(auth.uid(), group_id)
    AND EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = person_consents.subject_person_id
        AND p.group_id = person_consents.group_id
    )
  );

-- Phase 3B: approve_supported_person RPC
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

  -- Get the label from the request
  SELECT person_label INTO _label
  FROM public.person_access_requests
  WHERE id = p_request_id AND group_id = p_group_id AND status = 'pending';

  IF _label IS NULL THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Create persons row
  INSERT INTO public.persons (group_id, user_id, label, is_primary)
  VALUES (p_group_id, p_subject_user_id, _label, true)
  RETURNING id INTO _person_id;

  -- Mark request approved
  UPDATE public.person_access_requests
  SET status = 'approved', reviewed_by_user_id = _uid, reviewed_at = now()
  WHERE id = p_request_id;

  -- Create baseline consent
  INSERT INTO public.person_consents (group_id, subject_person_id, created_by_user_id, consent_scope)
  VALUES (p_group_id, _person_id, _uid, 'shared_notes_and_agreements_only');

  RETURN _person_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_supported_person(uuid, uuid, uuid) TO authenticated;