
-- 1) interventions table
CREATE TABLE public.interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  subject_person_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'support_action',
  status text NOT NULL DEFAULT 'planned',
  title text NOT NULL,
  rationale text NULL,
  start_at timestamptz NULL,
  end_at timestamptz NULL,
  visibility_tier text NOT NULL DEFAULT 'supporters_only',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;

-- SELECT: visibility-tiered access
CREATE POLICY "Members can select interventions"
  ON public.interventions
  FOR SELECT TO authenticated
  USING (
    public.is_group_member(auth.uid(), group_id)
    AND (
      (visibility_tier = 'shared_with_person')
      OR (
        visibility_tier = 'supporters_only'
        AND NOT EXISTS (
          SELECT 1 FROM public.persons p
          WHERE p.id = interventions.subject_person_id
            AND p.user_id = auth.uid()
        )
      )
      OR (
        visibility_tier = 'restricted'
        AND public.is_group_coordinator(auth.uid(), group_id)
      )
    )
  );

-- INSERT: group member, own user, person in group
CREATE POLICY "Members can insert interventions"
  ON public.interventions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_group_member(auth.uid(), group_id)
    AND created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = interventions.subject_person_id
        AND p.group_id = interventions.group_id
    )
  );

-- UPDATE: coordinators full, creators within 15 min
CREATE POLICY "Members can update interventions"
  ON public.interventions
  FOR UPDATE TO authenticated
  USING (
    public.is_group_member(auth.uid(), group_id)
    AND (
      public.is_group_coordinator(auth.uid(), group_id)
      OR (
        created_by_user_id = auth.uid()
        AND created_at > (now() - interval '15 minutes')
      )
    )
  )
  WITH CHECK (
    public.is_group_member(auth.uid(), group_id)
    AND (
      public.is_group_coordinator(auth.uid(), group_id)
      OR (
        created_by_user_id = auth.uid()
        AND created_at > (now() - interval '15 minutes')
      )
    )
  );

-- 2) intervention_private_details table
CREATE TABLE public.intervention_private_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  subject_person_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intervention_private_details ENABLE ROW LEVEL SECURITY;

-- SELECT: coordinators only
CREATE POLICY "Coordinators can select private details"
  ON public.intervention_private_details
  FOR SELECT TO authenticated
  USING (
    public.is_group_member(auth.uid(), group_id)
    AND public.is_group_coordinator(auth.uid(), group_id)
  );

-- INSERT: coordinators only, with referential integrity
CREATE POLICY "Coordinators can insert private details"
  ON public.intervention_private_details
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_group_member(auth.uid(), group_id)
    AND public.is_group_coordinator(auth.uid(), group_id)
    AND author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.interventions i
      WHERE i.id = intervention_private_details.intervention_id
        AND i.group_id = intervention_private_details.group_id
        AND i.subject_person_id = intervention_private_details.subject_person_id
    )
  );
