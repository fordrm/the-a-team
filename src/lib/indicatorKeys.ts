/**
 * Contact note indicator keys.
 * L-5: Centralized here for reuse. Future: fetch from a `indicator_definitions` table.
 */
export const INDICATOR_KEYS = [
  { key: "triangulation_claim_unlogged_agreement", label: "Triangulation: claim of unlogged agreement" },
  { key: "triangulation_pressure_secret", label: "Triangulation: pressure to keep secret" },
  { key: "conflict_tone_high", label: "Conflict tone high" },
  { key: "suspiciousness_high", label: "Suspiciousness high" },
  { key: "sleep_reduced", label: "Sleep reduced" },
  { key: "disorganization_high", label: "Disorganization high" },
] as const;

export type IndicatorKey = (typeof INDICATOR_KEYS)[number]["key"];
