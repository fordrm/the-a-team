
-- Create contact_notes table
CREATE TABLE public.contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  subject_person_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  visibility_tier text NOT NULL DEFAULT 'supporters_only',
  consent_level text NOT NULL DEFAULT 'supporter_reported',
  channel text NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  indicators jsonb NOT NULL DEFAULT '{}'::jsonb,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: visibility-tiered access
CREATE POLICY "Members can select contact_notes by visibility"
  ON public.contact_notes
  FOR SELECT
  TO authenticated
  USING (
    public.is_group_member(auth.uid(), group_id)
    AND (
      -- shared_with_person: any group member
      (visibility_tier = 'shared_with_person')
      -- supporters_only: group members EXCEPT the supported person
      OR (visibility_tier = 'supporters_only' AND NOT EXISTS (
        SELECT 1 FROM public.persons p
        WHERE p.id = contact_notes.subject_person_id
          AND p.user_id = auth.uid()
      ))
      -- restricted: only coordinators
      OR (visibility_tier = 'restricted' AND public.is_group_coordinator(auth.uid(), group_id))
    )
  );

-- INSERT: any active group member, author must be self
CREATE POLICY "Members can insert contact_notes"
  ON public.contact_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_group_member(auth.uid(), group_id)
    AND author_user_id = auth.uid()
  );

-- UPDATE: coordinators OR original author within 15 minutes
CREATE POLICY "Author or coordinator can update contact_notes"
  ON public.contact_notes
  FOR UPDATE
  TO authenticated
  USING (
    public.is_group_member(auth.uid(), group_id)
    AND (
      public.is_group_coordinator(auth.uid(), group_id)
      OR (author_user_id = auth.uid() AND created_at > now() - interval '15 minutes')
    )
  )
  WITH CHECK (
    public.is_group_member(auth.uid(), group_id)
    AND (
      public.is_group_coordinator(auth.uid(), group_id)
      OR (author_user_id = auth.uid() AND created_at > now() - interval '15 minutes')
    )
  );

-- No DELETE policy = immutable
