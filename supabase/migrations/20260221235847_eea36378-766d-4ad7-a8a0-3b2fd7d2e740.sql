
-- Create contradictions table
CREATE TABLE public.contradictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  subject_person_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open',
  severity text NOT NULL DEFAULT 'medium',
  type text NOT NULL DEFAULT 'triangulation',
  summary text NOT NULL,
  details text NULL,
  related_note_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  related_agreement_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  resolution text NULL,
  resolved_by_user_id uuid NULL,
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contradictions ENABLE ROW LEVEL SECURITY;

-- SELECT: group members can read, but supported person cannot see triangulation-type
CREATE POLICY "Members can select contradictions"
  ON public.contradictions
  FOR SELECT
  TO authenticated
  USING (
    public.is_group_member(auth.uid(), group_id)
    AND (
      -- coordinators see everything
      public.is_group_coordinator(auth.uid(), group_id)
      -- non-subject-person members see everything
      OR NOT EXISTS (
        SELECT 1 FROM public.persons p
        WHERE p.id = contradictions.subject_person_id
          AND p.user_id = auth.uid()
      )
      -- subject person can see non-triangulation types only
      OR (type != 'triangulation')
    )
  );

-- INSERT: active group member, self-attributed, person in same group
CREATE POLICY "Members can insert contradictions"
  ON public.contradictions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_group_member(auth.uid(), group_id)
    AND created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = contradictions.subject_person_id
        AND p.group_id = contradictions.group_id
    )
  );

-- UPDATE: coordinators full access; non-coordinators own rows within 15 min, cannot resolve/dismiss
CREATE POLICY "Coordinators can update contradictions"
  ON public.contradictions
  FOR UPDATE
  TO authenticated
  USING (
    public.is_group_member(auth.uid(), group_id)
    AND (
      public.is_group_coordinator(auth.uid(), group_id)
      OR (
        created_by_user_id = auth.uid()
        AND created_at > now() - interval '15 minutes'
      )
    )
  )
  WITH CHECK (
    public.is_group_member(auth.uid(), group_id)
    AND (
      public.is_group_coordinator(auth.uid(), group_id)
      OR (
        created_by_user_id = auth.uid()
        AND created_at > now() - interval '15 minutes'
        AND status NOT IN ('resolved', 'dismissed')
      )
    )
  );

-- No DELETE policy
