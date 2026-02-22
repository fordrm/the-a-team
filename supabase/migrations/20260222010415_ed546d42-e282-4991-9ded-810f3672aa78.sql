
-- Create alerts table
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  subject_person_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'tier1',
  title text NOT NULL,
  body text NULL,
  source_table text NULL,
  source_id uuid NULL,
  status text NOT NULL DEFAULT 'open',
  acknowledged_by_user_id uuid NULL,
  acknowledged_at timestamptz NULL,
  resolved_by_user_id uuid NULL,
  resolved_at timestamptz NULL,
  resolution_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- SELECT: coordinators see all; supporters see non-tier4 (excluding supported person)
CREATE POLICY "Members can select alerts"
  ON public.alerts
  FOR SELECT TO authenticated
  USING (
    public.is_group_member(auth.uid(), group_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = alerts.subject_person_id
        AND p.user_id = auth.uid()
    )
    AND (
      public.is_group_coordinator(auth.uid(), group_id)
      OR severity <> 'tier4'
    )
  );

-- INSERT: coordinators only, enforce ownership + person in group
CREATE POLICY "Coordinators can insert alerts"
  ON public.alerts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_group_member(auth.uid(), group_id)
    AND public.is_group_coordinator(auth.uid(), group_id)
    AND created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = alerts.subject_person_id
        AND p.group_id = alerts.group_id
    )
  );

-- UPDATE: coordinators only
CREATE POLICY "Coordinators can update alerts"
  ON public.alerts
  FOR UPDATE TO authenticated
  USING (
    public.is_group_member(auth.uid(), group_id)
    AND public.is_group_coordinator(auth.uid(), group_id)
  )
  WITH CHECK (
    public.is_group_member(auth.uid(), group_id)
    AND public.is_group_coordinator(auth.uid(), group_id)
  );
