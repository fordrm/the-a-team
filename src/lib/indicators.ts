export interface IndicatorDef {
  key: string;
  label: string;
}

export interface IndicatorCategory {
  id: string;
  label: string;
  color: string;
  indicators: IndicatorDef[];
}

export const INDICATOR_CATEGORIES: IndicatorCategory[] = [
  {
    id: "psychosis",
    label: "Psychosis",
    color: "text-purple-500",
    indicators: [
      { key: "suspiciousness_high", label: "Suspiciousness / paranoia" },
      { key: "disorganization_high", label: "Disorganized thinking / speech" },
      { key: "hallucinations_reported", label: "Hallucinations reported or suspected" },
      { key: "delusional_beliefs", label: "Delusional beliefs expressed" },
      { key: "social_withdrawal", label: "Social withdrawal / isolation" },
    ],
  },
  {
    id: "mood_manic",
    label: "Mood — Manic",
    color: "text-orange-500",
    indicators: [
      { key: "sleep_reduced", label: "Sleep reduced" },
      { key: "elevated_mood", label: "Elevated or expansive mood" },
      { key: "pressured_speech", label: "Pressured / rapid speech" },
      { key: "grandiosity", label: "Grandiosity" },
      { key: "impulsivity", label: "Impulsivity or risky behavior" },
      { key: "irritability_high", label: "Irritability high" },
    ],
  },
  {
    id: "mood_depressive",
    label: "Mood — Depressive",
    color: "text-blue-500",
    indicators: [
      { key: "flat_affect", label: "Flat affect / low mood" },
      { key: "sleep_increased", label: "Sleep increased" },
      { key: "hopelessness", label: "Hopelessness expressed" },
      { key: "loss_of_interest", label: "Loss of interest / withdrawal" },
    ],
  },
  {
    id: "functional",
    label: "Functional",
    color: "text-amber-600",
    indicators: [
      { key: "medication_nonadherence", label: "Medication non-adherence" },
      { key: "self_care_decline", label: "Self-care decline" },
      { key: "missed_appointments", label: "Missed appointments" },
      { key: "substance_use", label: "Substance use reported or suspected" },
    ],
  },
  {
    id: "relational",
    label: "Relational / Team",
    color: "text-red-500",
    indicators: [
      { key: "triangulation_claim_unlogged_agreement", label: "Triangulation: claim of unlogged agreement" },
      { key: "triangulation_pressure_secret", label: "Triangulation: pressure to keep secret" },
      { key: "conflict_tone_high", label: "Conflict tone high" },
    ],
  },
];

export const ALL_INDICATORS: IndicatorDef[] = INDICATOR_CATEGORIES.flatMap(c => c.indicators);

export const INDICATOR_LABEL_MAP: Record<string, string> = Object.fromEntries(
  ALL_INDICATORS.map(i => [i.key, i.label])
);

export const INDICATOR_CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  INDICATOR_CATEGORIES.flatMap(c => c.indicators.map(i => [i.key, c.label]))
);
