import { INDICATOR_CATEGORIES, type IndicatorDef } from "./indicators";

/** First-person labels for self-report check-in UI */
export const SELF_REPORT_LABELS: Record<string, string> = {
  // Psychosis
  suspiciousness_high: "I'm feeling distrustful or on edge",
  disorganization_high: "My thoughts feel scattered or hard to express",
  hallucinations_reported: "I'm sensing things others don't seem to notice",
  delusional_beliefs: "I have beliefs others seem to question",
  social_withdrawal: "I've been pulling away from people",

  // Mood — Manic
  sleep_reduced: "I don't feel like I need much sleep",
  elevated_mood: "I have a lot more energy than usual",
  pressured_speech: "I'm talking faster than usual",
  grandiosity: "My ideas feel bigger than usual",
  impulsivity: "I'm making decisions faster than usual",
  irritability_high: "I've been more irritable than usual",

  // Mood — Depressive
  flat_affect: "I'm feeling down or heavy",
  sleep_increased: "I'm sleeping more than usual",
  hopelessness: "It's hard to see things getting better",
  loss_of_interest: "I don't feel like doing things I usually enjoy",

  // Functional
  medication_nonadherence: "I've missed or changed my medication",
  self_care_decline: "Self-care has been harder lately",
  missed_appointments: "I've missed or skipped something important",
  substance_use: "I've been using substances",

  // Relational
  triangulation_claim_unlogged_agreement: "There's been confusion about what was agreed",
  triangulation_pressure_secret: "I've felt pressure to keep something secret",
  conflict_tone_high: "There's been tension with my team",
};

export interface SelfReportCategory {
  id: string;
  label: string;
  color: string;
  indicators: { key: string; selfLabel: string; originalLabel: string }[];
}

export const SELF_REPORT_CATEGORIES: SelfReportCategory[] = [
  {
    id: "mood_energy",
    label: "Mood & Energy",
    color: "text-orange-500",
    indicators: [
      ...INDICATOR_CATEGORIES.find(c => c.id === "mood_manic")!.indicators.map(i => ({
        key: i.key,
        selfLabel: SELF_REPORT_LABELS[i.key] || i.label,
        originalLabel: i.label,
      })),
      ...INDICATOR_CATEGORIES.find(c => c.id === "mood_depressive")!.indicators.map(i => ({
        key: i.key,
        selfLabel: SELF_REPORT_LABELS[i.key] || i.label,
        originalLabel: i.label,
      })),
    ],
  },
  {
    id: "sleep_daily",
    label: "Sleep & Daily Life",
    color: "text-amber-600",
    indicators: INDICATOR_CATEGORIES.find(c => c.id === "functional")!.indicators.map(i => ({
      key: i.key,
      selfLabel: SELF_REPORT_LABELS[i.key] || i.label,
      originalLabel: i.label,
    })),
  },
  {
    id: "thoughts_perceptions",
    label: "Thoughts & Perceptions",
    color: "text-purple-500",
    indicators: INDICATOR_CATEGORIES.find(c => c.id === "psychosis")!.indicators.map(i => ({
      key: i.key,
      selfLabel: SELF_REPORT_LABELS[i.key] || i.label,
      originalLabel: i.label,
    })),
  },
  {
    id: "connections",
    label: "Connections & Relationships",
    color: "text-red-500",
    indicators: INDICATOR_CATEGORIES.find(c => c.id === "relational")!.indicators.map(i => ({
      key: i.key,
      selfLabel: SELF_REPORT_LABELS[i.key] || i.label,
      originalLabel: i.label,
    })),
  },
];
