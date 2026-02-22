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
