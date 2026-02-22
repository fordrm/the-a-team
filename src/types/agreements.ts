export interface CadenceValue {
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "custom";
  time?: string;
  days?: string[];
  custom_text?: string;
}

export interface DurationValue {
  type: "fixed" | "ongoing" | "until_review";
  days?: number;
  end_date?: string;
}

export interface VersionFields {
  title?: string;
  body?: string;
  i_will_statement?: string;
  metric_definition?: string;
  cadence_or_due_date?: string;
  cadence?: CadenceValue;
  duration?: DurationValue;
  check_in_method?: string;
  support_needed?: string;
  renegotiation_trigger?: string;
  linked_indicators?: string[];
  renewed_from?: string;
}

export function formatCadenceDisplay(fields: VersionFields): string {
  if (fields.cadence) {
    const c = fields.cadence;
    if (c.frequency === "custom") return c.custom_text || "Custom schedule";
    let s = c.frequency.charAt(0).toUpperCase() + c.frequency.slice(1);
    if (c.time) {
      const [h, m] = c.time.split(":");
      const hour = parseInt(h);
      const ampm = hour >= 12 ? "PM" : "AM";
      const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      s += ` at ${h12}:${m} ${ampm}`;
    }
    if (c.days && c.days.length > 0 && c.frequency === "weekly") {
      s += ` (${c.days.join(", ")})`;
    }
    return s;
  }
  return fields.cadence_or_due_date || "";
}

export function formatDurationDisplay(fields: VersionFields): string {
  if (fields.duration) {
    const d = fields.duration;
    if (d.type === "ongoing") return "Ongoing";
    if (d.type === "until_review") return "Until next review";
    if (d.type === "fixed" && d.days) {
      const endStr = d.end_date ? ` (ends ${d.end_date})` : "";
      return `${d.days} days${endStr}`;
    }
  }
  return "";
}

export interface FieldDiff {
  label: string;
  oldValue: string;
  newValue: string;
}

export function computeFieldDiffs(
  oldFields: VersionFields,
  newFields: VersionFields
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  if (oldFields.title !== newFields.title && oldFields.title && newFields.title) {
    diffs.push({ label: "Title", oldValue: oldFields.title, newValue: newFields.title });
  }

  if (oldFields.i_will_statement !== newFields.i_will_statement && oldFields.i_will_statement && newFields.i_will_statement) {
    diffs.push({ label: "Commitment", oldValue: oldFields.i_will_statement, newValue: newFields.i_will_statement });
  }

  if (oldFields.cadence && newFields.cadence) {
    const oldCadence = formatCadenceDisplay(oldFields);
    const newCadence = formatCadenceDisplay(newFields);
    if (oldCadence !== newCadence) {
      diffs.push({ label: "Schedule", oldValue: oldCadence, newValue: newCadence });
    }
  } else if (oldFields.cadence_or_due_date !== newFields.cadence_or_due_date && oldFields.cadence_or_due_date && newFields.cadence_or_due_date) {
    diffs.push({ label: "Schedule", oldValue: oldFields.cadence_or_due_date, newValue: newFields.cadence_or_due_date });
  }

  if (oldFields.duration && newFields.duration) {
    const oldDur = formatDurationDisplay(oldFields);
    const newDur = formatDurationDisplay(newFields);
    if (oldDur !== newDur) {
      diffs.push({ label: "Duration", oldValue: oldDur, newValue: newDur });
    }
  }

  if (oldFields.metric_definition !== newFields.metric_definition && oldFields.metric_definition && newFields.metric_definition) {
    diffs.push({ label: "Metric", oldValue: oldFields.metric_definition, newValue: newFields.metric_definition });
  }

  if (oldFields.check_in_method !== newFields.check_in_method && oldFields.check_in_method && newFields.check_in_method) {
    diffs.push({ label: "Check-in", oldValue: oldFields.check_in_method, newValue: newFields.check_in_method });
  }

  if (oldFields.body !== newFields.body && oldFields.body && newFields.body) {
    const maxLen = 60;
    const oldTrunc = oldFields.body.length > maxLen ? oldFields.body.slice(0, maxLen) + "…" : oldFields.body;
    const newTrunc = newFields.body.length > maxLen ? newFields.body.slice(0, maxLen) + "…" : newFields.body;
    diffs.push({ label: "Terms", oldValue: oldTrunc, newValue: newTrunc });
  }

  return diffs;
}

// ─── Status & Closure Types ─────────────────────────────
export type AgreementStatus =
  | "draft"
  | "proposed"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "review_needed"
  | "completed"
  | "incomplete"
  | "lapsed";

export type ClosureStatus = "completed" | "incomplete" | "lapsed";

export type PersonAssessment = "going_well" | "struggling" | "want_change" | "move_on";

export interface ClosureData {
  status: ClosureStatus;
  closed_by: string;
  closed_at: string;
  compliance_estimate?: number;
  person_assessment?: PersonAssessment;
  reflection?: string;
  renewed_as?: string;
  early_close?: boolean;
  days_active?: number;
  days_planned?: number;
}

export const TERMINAL_STATUSES: AgreementStatus[] = ["completed", "incomplete", "lapsed"];
export const ACTIVE_STATUSES: AgreementStatus[] = ["accepted", "review_needed"];
export const PENDING_STATUSES: AgreementStatus[] = ["proposed", "draft"];

export const PERSON_ASSESSMENT_OPTIONS: { value: PersonAssessment; label: string; emoji: string }[] = [
  { value: "going_well", label: "Going well", emoji: "😊" },
  { value: "struggling", label: "Struggling", emoji: "😐" },
  { value: "want_change", label: "Want to change it", emoji: "🔄" },
  { value: "move_on", label: "Ready to move on", emoji: "✓" },
];
