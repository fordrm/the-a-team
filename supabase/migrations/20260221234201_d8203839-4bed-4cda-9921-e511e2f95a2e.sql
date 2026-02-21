
-- 1) agreements
CREATE TABLE public.agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  subject_person_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  current_version_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

-- SELECT: active group members
CREATE POLICY "Members can select agreements"
  ON public.agreements FOR SELECT
  TO authenticated
  USING (public.is_group_member(auth.uid(), group_id));

-- INSERT: active group members, created_by must be self
CREATE POLICY "Members can insert agreements"
  ON public.agreements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_group_member(auth.uid(), group_id) AND created_by_user_id = auth.uid());

-- UPDATE: coordinators only, restricted columns
CREATE POLICY "Coordinators can update agreements"
  ON public.agreements FOR UPDATE
  TO authenticated
  USING (public.is_group_coordinator(auth.uid(), group_id))
  WITH CHECK (public.is_group_coordinator(auth.uid(), group_id));

-- 2) agreement_versions (IMMUTABLE)
CREATE TABLE public.agreement_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  proposed_by_user_id uuid NOT NULL,
  version_num int NOT NULL,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agreement_id, version_num)
);

ALTER TABLE public.agreement_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can select agreement_versions"
  ON public.agreement_versions FOR SELECT
  TO authenticated
  USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Members can insert agreement_versions"
  ON public.agreement_versions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_group_member(auth.uid(), group_id) AND proposed_by_user_id = auth.uid());

-- No UPDATE or DELETE policies = immutable

-- 3) agreement_acceptances (IMMUTABLE)
CREATE TABLE public.agreement_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_version_id uuid NOT NULL REFERENCES public.agreement_versions(id) ON DELETE CASCADE,
  agreement_id uuid NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  person_user_id uuid NOT NULL,
  status text NOT NULL,
  message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agreement_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can select agreement_acceptances"
  ON public.agreement_acceptances FOR SELECT
  TO authenticated
  USING (public.is_group_member(auth.uid(), group_id));

-- Only the supported person (person_user_id = auth.uid()) can insert
CREATE POLICY "Person can insert acceptance"
  ON public.agreement_acceptances FOR INSERT
  TO authenticated
  WITH CHECK (public.is_group_member(auth.uid(), group_id) AND person_user_id = auth.uid());

-- No UPDATE or DELETE policies = immutable
