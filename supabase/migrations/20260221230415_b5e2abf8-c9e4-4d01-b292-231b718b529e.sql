
-- 1) groups table
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- 2) group_memberships table
CREATE TABLE public.group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;

-- 3) persons table
CREATE TABLE public.persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid,
  label text NOT NULL,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is active member of a group
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE user_id = _user_id
      AND group_id = _group_id
      AND is_active = true
  )
$$;

-- Helper function: check if user is coordinator of a group
CREATE OR REPLACE FUNCTION public.is_group_coordinator(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE user_id = _user_id
      AND group_id = _group_id
      AND role = 'coordinator'
      AND is_active = true
  )
$$;

-- RLS: groups
CREATE POLICY "Users can select their groups"
  ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(auth.uid(), id));

CREATE POLICY "Users can insert groups"
  ON public.groups FOR INSERT TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

-- RLS: group_memberships
CREATE POLICY "Members can select memberships of their groups"
  ON public.group_memberships FOR SELECT TO authenticated
  USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Coordinators can insert memberships"
  ON public.group_memberships FOR INSERT TO authenticated
  WITH CHECK (public.is_group_coordinator(auth.uid(), group_id));

-- Special policy: allow creator to insert their own first membership
-- (they won't be coordinator yet at insert time for self-membership)
CREATE POLICY "Creator can insert own membership"
  ON public.group_memberships FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'coordinator'
    AND EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_id AND created_by_user_id = auth.uid()
    )
  );

-- RLS: persons
CREATE POLICY "Members can select persons of their groups"
  ON public.persons FOR SELECT TO authenticated
  USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Coordinators can insert persons"
  ON public.persons FOR INSERT TO authenticated
  WITH CHECK (public.is_group_coordinator(auth.uid(), group_id));
