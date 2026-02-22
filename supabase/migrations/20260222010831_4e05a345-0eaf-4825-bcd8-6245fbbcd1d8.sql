
DROP POLICY "Coordinators can insert alerts" ON public.alerts;

-- Non-coordinator members can insert tier1–tier3 alerts (not supported person)
CREATE POLICY "Members can insert non-tier4 alerts"
  ON public.alerts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_group_member(auth.uid(), group_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = alerts.subject_person_id
        AND p.user_id = auth.uid()
    )
    AND created_by_user_id = auth.uid()
    AND severity <> 'tier4'
    AND EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = alerts.subject_person_id
        AND p.group_id = alerts.group_id
    )
    AND type IN (
      'contradiction_opened',
      'agreement_declined',
      'agreement_modified',
      'intervention_stopped',
      'pattern_signal'
    )
  );

-- Coordinators can insert any alert including tier4
CREATE POLICY "Coordinators can insert tier4 alerts"
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
