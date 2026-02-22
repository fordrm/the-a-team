export interface IndicatorDef {
  key: string;
  label: string;
  tip: string;
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
      { key: "suspiciousness_high", label: "Suspiciousness / paranoia", tip: "Person expresses unusual distrust, believes others are plotting against them, or interprets neutral events as threatening." },
      { key: "disorganization_high", label: "Disorganized thinking / speech", tip: "Speech is hard to follow — jumping between unrelated topics, using made-up words, or losing track of what they were saying." },
      { key: "hallucinations_reported", label: "Hallucinations reported or suspected", tip: "Person mentions seeing, hearing, or sensing things others don't, or you notice them responding to things that aren't there." },
      { key: "delusional_beliefs", label: "Delusional beliefs expressed", tip: "Person states beliefs that are clearly not grounded in reality — e.g. they have special powers, are being watched by agencies, or are receiving hidden messages." },
      { key: "social_withdrawal", label: "Social withdrawal / isolation", tip: "Person is avoiding contact, canceling plans, not answering calls/texts, or spending noticeably more time alone than usual." },
    ],
  },
  {
    id: "mood_manic",
    label: "Mood — Manic",
    color: "text-orange-500",
    indicators: [
      { key: "sleep_reduced", label: "Sleep reduced", tip: "Person reports sleeping much less than usual (e.g. 3-4 hours) but doesn't feel tired. This is a key early warning sign." },
      { key: "elevated_mood", label: "Elevated or expansive mood", tip: "Person seems unusually euphoric, overly cheerful, or \"high\" in a way that feels out of proportion to their situation." },
      { key: "pressured_speech", label: "Pressured / rapid speech", tip: "Person is talking much faster than normal, hard to interrupt, jumping quickly from topic to topic." },
      { key: "grandiosity", label: "Grandiosity", tip: "Person expresses inflated self-importance — e.g. claiming special abilities, making unrealistic plans, or believing they're destined for something extraordinary." },
      { key: "impulsivity", label: "Impulsivity or risky behavior", tip: "Person is making unusual snap decisions — spending sprees, risky driving, sudden major life changes, or uncharacteristic sexual behavior." },
      { key: "irritability_high", label: "Irritability high", tip: "Person is unusually short-tempered, easily frustrated, or reacting with anger disproportionate to the situation." },
    ],
  },
  {
    id: "mood_depressive",
    label: "Mood — Depressive",
    color: "text-blue-500",
    indicators: [
      { key: "flat_affect", label: "Flat affect / low mood", tip: "Person shows little emotional expression, speaks in a monotone, or reports feeling empty, sad, or numb." },
      { key: "sleep_increased", label: "Sleep increased", tip: "Person is sleeping significantly more than usual, struggling to get out of bed, or napping excessively during the day." },
      { key: "hopelessness", label: "Hopelessness expressed", tip: "Person makes statements like \"nothing will get better,\" \"what's the point,\" or expresses a belief that their situation is permanent." },
      { key: "loss_of_interest", label: "Loss of interest / withdrawal", tip: "Person has stopped doing activities they normally enjoy, shows no enthusiasm, or says they \"don't care\" about things that used to matter." },
    ],
  },
  {
    id: "functional",
    label: "Functional",
    color: "text-amber-600",
    indicators: [
      { key: "medication_nonadherence", label: "Medication non-adherence", tip: "Person mentions skipping, reducing, or stopping their medication — or you notice signs that suggest they may not be taking it consistently." },
      { key: "self_care_decline", label: "Self-care decline", tip: "Noticeable decline in personal hygiene, grooming, nutrition, or living environment compared to their baseline." },
      { key: "missed_appointments", label: "Missed appointments", tip: "Person has missed or cancelled scheduled appointments (medical, therapy, support meetings) without rescheduling." },
      { key: "substance_use", label: "Substance use reported or suspected", tip: "Person mentions using alcohol or substances, or you notice signs like slurred speech, unusual smell, or behavioral changes consistent with substance use." },
    ],
  },
  {
    id: "relational",
    label: "Relational / Team",
    color: "text-red-500",
    indicators: [
      { key: "triangulation_claim_unlogged_agreement", label: "Triangulation: claim of unlogged agreement", tip: "Person claims another team member agreed to something that isn't recorded in the app — e.g. \"Sarah said I could skip that.\" Log it here so the team can verify." },
      { key: "triangulation_pressure_secret", label: "Triangulation: pressure to keep secret", tip: "Person asks you not to tell other team members something, or pressures you to keep information \"between us.\" This can undermine coordinated care." },
      { key: "conflict_tone_high", label: "Conflict tone high", tip: "The interaction had a notably confrontational, hostile, or aggressive tone — whether from the person, between team members, or directed at the support structure." },
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

/** Returns the Tailwind bg + text classes for an indicator's category badge */
export function getIndicatorBadgeColor(key: string): string {
  const colorMap: Record<string, string> = {
    "purple": "bg-purple-100 text-purple-700 border-purple-200",
    "orange": "bg-orange-100 text-orange-700 border-orange-200",
    "blue": "bg-blue-100 text-blue-700 border-blue-200",
    "amber": "bg-amber-100 text-amber-700 border-amber-200",
    "red": "bg-red-100 text-red-700 border-red-200",
  };
  for (const cat of INDICATOR_CATEGORIES) {
    if (cat.indicators.some(i => i.key === key)) {
      const base = cat.color.replace("text-", "").replace(/(-\d+)$/, "");
      return colorMap[base] || "bg-gray-100 text-gray-700 border-gray-200";
    }
  }
  return "bg-gray-100 text-gray-700 border-gray-200";
}
