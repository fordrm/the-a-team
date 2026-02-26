// UI labels — the database still uses "agreements" everywhere
export const PLAN_LABELS = {
  // Navigation and headers
  tabName: 'Our Plan',
  sectionTitle: 'Our Plan',

  // Individual items
  singular: 'commitment',
  plural: 'commitments',
  createButton: 'New Commitment',
  createTitle: 'Create a Commitment',

  // Status labels
  active: 'Active',
  pending: 'Needs Response',
  closed: 'Completed',
  draft: 'Draft',

  // Sections within a commitment
  personSection: "What I'll do",
  teamSection: "What the team will do",
  guardrailsSection: "Guardrails",

  // Actions
  accept: 'Accept',
  modify: 'Suggest Changes',
  decline: 'Decline',
  revisit: "I'd like to revisit this",

  // Empty states
  emptyActive: "No active commitments yet. Start by creating one together.",
  emptyPending: "Nothing needs your response right now.",
  emptyClosed: "No completed commitments yet.",

  // Timeline event labels
  eventCreated: 'Commitment created',
  eventAccepted: 'Commitment accepted',
  eventModified: 'Changes suggested',
  eventDeclined: 'Commitment declined',
  eventWithdrawn: 'Commitment withdrawn',
  eventCompleted: 'Commitment completed',
  eventIncomplete: 'Commitment incomplete',
  eventLapsed: 'Commitment lapsed',
  eventReviewNeeded: 'Review due',
  eventSelfAssessed: 'Self-assessment',
} as const;
