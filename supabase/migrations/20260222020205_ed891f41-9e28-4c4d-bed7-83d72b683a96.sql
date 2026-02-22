
-- Create group_invites table
CREATE TABLE public.group_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id),
  email text NOT NULL,
  role text NOT NULL,
  display_name text,
  invited_by uuid NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- Coordinators can view invites for their groups
CREATE POLICY "Coordinators can select group_invites"
ON public.group_invites FOR SELECT
USING (is_group_coordinator(auth.uid(), group_id));

-- Coordinators can insert invites (via RPC primarily, but policy needed)
CREATE POLICY "Coordinators can insert group_invites"
ON public.group_invites FOR INSERT
WITH CHECK (is_group_coordinator(auth.uid(), group_id) AND invited_by = auth.uid());

-- Coordinators can update invites (mark accepted)
CREATE POLICY "Coordinators can update group_invites"
ON public.group_invites FOR UPDATE
USING (is_group_coordinator(auth.uid(), group_id));

-- Create the SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.invite_member_by_email(
  p_group_id uuid,
  p_email text,
  p_role text,
  p_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _target_user_id uuid;
  _result jsonb;
BEGIN
  -- Must be authenticated
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Must be coordinator of this group
  IF NOT is_group_coordinator(_uid, p_group_id) THEN
    RAISE EXCEPTION 'Only coordinators can invite members';
  END IF;

  -- Validate role
  IF p_role NOT IN ('member', 'supporter', 'coordinator') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- Check if user exists in auth.users
  SELECT id INTO _target_user_id
  FROM auth.users
  WHERE email = lower(trim(p_email));

  IF _target_user_id IS NOT NULL THEN
    -- Check if already a member
    IF EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE group_id = p_group_id AND user_id = _target_user_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'User is already a member of this group';
    END IF;

    -- Insert membership directly
    INSERT INTO public.group_memberships (group_id, user_id, role, display_name, is_active, capabilities)
    VALUES (p_group_id, _target_user_id, p_role, p_display_name, true, '{}'::jsonb);

    _result := jsonb_build_object('status', 'member_added', 'message', 'User added to group directly');
  ELSE
    -- Check for existing pending invite
    IF EXISTS (
      SELECT 1 FROM public.group_invites
      WHERE group_id = p_group_id AND email = lower(trim(p_email)) AND accepted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'An invite for this email is already pending';
    END IF;

    -- Insert invite
    INSERT INTO public.group_invites (group_id, email, role, display_name, invited_by)
    VALUES (p_group_id, lower(trim(p_email)), p_role, p_display_name, _uid);

    _result := jsonb_build_object('status', 'invite_created', 'message', 'Invite saved. User will be added when they sign up.');
  END IF;

  RETURN _result;
END;
$$;
