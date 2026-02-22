import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ChevronDown, Info } from "lucide-react";
import type { CadenceValue, DurationValue, VersionFields } from "@/types/agreements";

interface Props {
  groupId: string;
  personId: string;
  onBack: () => void;
  onCreated: (agreementId: string) => void;
}

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom schedule" },
];

const DAY_OPTIONS = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

const CHECK_IN_OPTIONS = [
  { value: "timeline_note", label: "Timeline note" },
  { value: "text_message", label: "Text message" },
  { value: "phone_call", label: "Phone call" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Other" },
];

function FieldHint({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1 text-xs text-muted-foreground mt-1">
      <Info className="h-3 w-3 mt-0.5 shrink-0" />
      {text}
    </p>
  );
}

function formatCadenceSummary(c: CadenceValue): string {
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

function getCompleteness(fields: {
  title: string;
  i_will: string;
  cadence: CadenceValue;
  metric: string;
  duration: DurationValue;
}): { score: number; checks: { label: string; done: boolean }[] } {
  const checks = [
    { label: "Clear commitment", done: fields.title.trim().length > 0 && fields.i_will.trim().length > 0 },
    { label: "Specific schedule", done: !!fields.cadence.frequency },
    { label: "Measurable", done: fields.metric.trim().length > 0 },
    { label: "Time-bound", done: !!fields.duration.type },
  ];
  const score = checks.filter(c => c.done).length;
  return { score, checks };
}

export default function CreateAgreement({ groupId, personId, onBack, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [iWill, setIWill] = useState("");

  const [cadence, setCadence] = useState<CadenceValue>({ frequency: "daily" });
  const [duration, setDuration] = useState<DurationValue>({ type: "fixed", days: 30 });
  const [checkInMethod, setCheckInMethod] = useState("timeline_note");
  const [checkInOther, setCheckInOther] = useState("");

  const [metric, setMetric] = useState("");
  const [renegotiationTrigger, setRenegotiationTrigger] = useState("");

  const [body, setBody] = useState("");
  const [supportNeeded, setSupportNeeded] = useState("");
  const [contextOpen, setContextOpen] = useState(false);

  const completeness = getCompleteness({ title, i_will: iWill, cadence, metric, duration });
  const strengthLabel = completeness.score <= 1 ? "Needs detail" : completeness.score <= 2 ? "Getting there" : completeness.score <= 3 ? "Good" : "Strong";
  const strengthColor = completeness.score <= 1 ? "text-destructive" : completeness.score <= 2 ? "text-amber-500" : completeness.score <= 3 ? "text-blue-500" : "text-green-500";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      const computedDuration = { ...duration };
      if (computedDuration.type === "fixed" && computedDuration.days) {
        const end = new Date();
        end.setDate(end.getDate() + computedDuration.days);
        computedDuration.end_date = end.toISOString().split("T")[0];
      }

      const fields: VersionFields = {
        title,
        body: body || undefined,
        i_will_statement: iWill,
        metric_definition: metric || undefined,
        cadence,
        cadence_or_due_date: formatCadenceSummary(cadence),
        duration: computedDuration,
        check_in_method: checkInMethod === "other" ? checkInOther : checkInMethod,
        support_needed: supportNeeded || undefined,
        renegotiation_trigger: renegotiationTrigger || undefined,
      };

      const { data, error } = await supabase.rpc("create_agreement_with_version", {
        p_group_id: groupId,
        p_subject_person_id: personId,
        p_fields: fields as any,
        p_created_by: user.id,
      });

      if (error) throw error;
      toast({ title: "Agreement created" });
      onCreated(data as string);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <CardTitle className="text-lg">New Agreement</CardTitle>

        {/* Completeness indicator */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all rounded-full"
                style={{ width: `${(completeness.score / 4) * 100}%` }}
              />
            </div>
            <span className={`text-xs font-medium ${strengthColor}`}>{strengthLabel}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {completeness.checks.map(c => (
              <span key={c.label} className={`text-xs ${c.done ? "text-green-600" : "text-muted-foreground"}`}>
                {c.done ? "✓" : "○"} {c.label}
              </span>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Section 1: The Commitment */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">The Commitment</h3>

            <div className="space-y-1">
              <Label htmlFor="title">What's the agreement about?</Label>
              <Input
                id="title"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Medication check-in"
              />
              <FieldHint text="A short, descriptive name for this agreement" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="i_will">What does the person commit to?</Label>
              <Input
                id="i_will"
                required
                value={iWill}
                onChange={e => setIWill(e.target.value)}
                placeholder="e.g., I'll confirm I took my morning meds"
              />
              <FieldHint text="Start with 'I will…' — make it specific and achievable" />
            </div>
          </div>

          {/* Section 2: The Schedule */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">The Schedule</h3>

            <div className="space-y-1">
              <Label>How often?</Label>
              <div className="flex gap-2">
                <Select
                  value={cadence.frequency}
                  onValueChange={(val) => setCadence(prev => ({
                    ...prev,
                    frequency: val as CadenceValue["frequency"],
                    days: val === "weekly" ? prev.days : undefined,
                    custom_text: val === "custom" ? prev.custom_text : undefined,
                  }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {cadence.frequency !== "custom" && (
                  <Input
                    type="time"
                    className="w-32"
                    value={cadence.time || ""}
                    onChange={e => setCadence(prev => ({ ...prev, time: e.target.value }))}
                    placeholder="Time"
                  />
                )}
              </div>

              {cadence.frequency === "weekly" && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {DAY_OPTIONS.map(d => (
                    <Button
                      key={d.value}
                      type="button"
                      size="sm"
                      variant={cadence.days?.includes(d.value) ? "default" : "outline"}
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        setCadence(prev => {
                          const current = prev.days || [];
                          const next = current.includes(d.value)
                            ? current.filter(x => x !== d.value)
                            : [...current, d.value];
                          return { ...prev, days: next };
                        });
                      }}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
              )}

              {cadence.frequency === "custom" && (
                <Input
                  value={cadence.custom_text || ""}
                  onChange={e => setCadence(prev => ({ ...prev, custom_text: e.target.value }))}
                  placeholder="Describe the schedule (e.g., every other Tuesday)"
                  className="mt-1"
                />
              )}

              <FieldHint text="How frequently should this happen?" />
            </div>

            <div className="space-y-1">
              <Label>For how long?</Label>
              <div className="flex gap-2 items-center">
                <Select
                  value={duration.type}
                  onValueChange={(val) => setDuration(prev => ({
                    ...prev,
                    type: val as DurationValue["type"],
                    days: val === "fixed" ? (prev.days || 30) : undefined,
                  }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed period</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="until_review">Until next review</SelectItem>
                  </SelectContent>
                </Select>

                {duration.type === "fixed" && (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="w-20"
                      value={duration.days || 30}
                      onChange={e => setDuration(prev => ({ ...prev, days: parseInt(e.target.value) || 30 }))}
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>How will check-ins happen?</Label>
              <Select value={checkInMethod} onValueChange={setCheckInMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHECK_IN_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {checkInMethod === "other" && (
                <Input
                  value={checkInOther}
                  onChange={e => setCheckInOther(e.target.value)}
                  placeholder="Describe the check-in method"
                  className="mt-1"
                />
              )}
            </div>
          </div>

          {/* Section 3: Measuring Success */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Measuring Success</h3>

            <div className="space-y-1">
              <Label htmlFor="metric">How will we know it's happening?</Label>
              <Input
                id="metric"
                value={metric}
                onChange={e => setMetric(e.target.value)}
                placeholder="e.g., Timeline note posted after each check-in"
              />
              <FieldHint text="What evidence shows the commitment is being kept?" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="renegotiation">When should we revisit this?</Label>
              <Input
                id="renegotiation"
                value={renegotiationTrigger}
                onChange={e => setRenegotiationTrigger(e.target.value)}
                placeholder="e.g., If 3 consecutive check-ins are missed"
              />
              <FieldHint text="What would trigger a conversation about changing the agreement?" />
            </div>
          </div>

          {/* Section 4: Additional Context (collapsed) */}
          <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronDown className={`h-4 w-4 transition-transform ${contextOpen ? "rotate-180" : ""}`} />
              Additional context
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="body">Anything else to add?</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Additional terms, background, conditions…"
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="support">What support does the team provide?</Label>
                <Textarea
                  id="support"
                  value={supportNeeded}
                  onChange={e => setSupportNeeded(e.target.value)}
                  placeholder="e.g., Mom will send a reminder text at 11:45 AM"
                  rows={2}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Button type="submit" className="w-full" disabled={saving || !title.trim() || !iWill.trim()}>
            {saving ? "Creating…" : "Create Agreement"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
