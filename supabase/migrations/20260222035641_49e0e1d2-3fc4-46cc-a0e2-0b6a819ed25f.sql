
-- ============================================================
-- LOW-severity fixes — database hardening
-- ============================================================

-- L-1: Unique constraint to prevent duplicate pending access requests
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_access_request
  ON public.person_access_requests (group_id, requester_user_id)
  WHERE status = 'pending';

-- L-2: Foreign key on group_invites.invited_by → auth.users(id)
COMMENT ON COLUMN public.group_invites.invited_by IS
  'References auth.users(id). FK cannot be created across schemas in Supabase; enforced by RLS policy requiring invited_by = auth.uid().';

-- L-9: Missing GRANT statements on agreement RPCs
GRANT EXECUTE ON FUNCTION public.create_agreement_with_version(uuid, uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.propose_agreement_version(uuid, uuid, text) TO authenticated;

-- L-4: Audit trail table for critical operations
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_user_id uuid NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  target_type text,
  target_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordinators can select audit_log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (is_group_coordinator(auth.uid(), group_id));

CREATE INDEX IF NOT EXISTS idx_audit_log_group_id ON public.audit_log (group_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON public.audit_log (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);

-- L-4 continued: Helper function to write audit entries
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_event_type text,
  p_actor_user_id uuid,
  p_group_id uuid,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_log (event_type, actor_user_id, group_id, target_type, target_id, metadata)
  VALUES (p_event_type, p_actor_user_id, p_group_id, p_target_type, p_target_id, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION public.write_audit_log(text, uuid, uuid, text, uuid, jsonb) TO authenticated;

-- L-4: Add audit logging to approve_supported_person RPC
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

  -- Audit log
  PERFORM write_audit_log(
    'person_approved',
    _uid,
    p_group_id,
    'person',
    _person_id,
    jsonb_build_object('request_id', p_request_id, 'subject_user_id', p_subject_user_id, 'label', _label)
  );

  RETURN _person_id;
END;
$$;
