-- Add pinned column to contact_notes
ALTER TABLE contact_notes ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

-- Index for fast ordering (pinned first)
CREATE INDEX IF NOT EXISTS idx_contact_notes_pinned ON contact_notes (group_id, subject_person_id, pinned DESC, occurred_at DESC);