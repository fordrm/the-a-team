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
import { ArrowLeft, ChevronDown, Settings2 } from "lucide-react";
import type { CadenceValue, DurationValue, VersionFields } from "@/types/agreements";
import { RefreshCw } from "lucide-react";

interface Props {
  groupId: string;
  personId: string;
  prefillFields?: VersionFields | null;
  onBack: () => void;
  onCreated: (agreementId: string) => void;
}

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

const DAY_OPTIONS = [
  { value: "mon", label: "M" },
  { value: "tue", label: "T" },
  { value: "wed", label: "W" },
  { value: "thu", label: "T" },
  { value: "fri", label: "F" },
  { value: "sat", label: "S" },
  { value: "sun", label: "S" },
];

const CHECK_IN_OPTIONS = [
  { value: "timeline_note", label: "Timeline note" },
  { value: "text_message", label: "Text message" },
  { value: "phone_call", label: "Phone call" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Other" },
];

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

export default function CreateAgreement({ groupId, personId, prefillFields, onBack, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Core fields (always visible) — initialized from prefill if renewing
  const [title, setTitle] = useState(prefillFields?.title || "");
  const [iWill, setIWill] = useState(prefillFields?.i_will_statement || "");
  const [cadence, setCadence] = useState<CadenceValue>(
    (prefillFields?.cadence as CadenceValue) || { frequency: "daily" }
  );
  const [duration, setDuration] = useState<DurationValue>(
    (prefillFields?.duration as DurationValue) || { type: "fixed", days: 30 }
  );

  // Expanded fields (hidden by default)
  const [expanded, setExpanded] = useState(false);
  const [checkInMethod, setCheckInMethod] = useState(prefillFields?.check_in_method || "timeline_note");
  const [checkInOther, setCheckInOther] = useState("");
  const [metric, setMetric] = useState(prefillFields?.metric_definition || "");
  const [renegotiationTrigger, setRenegotiationTrigger] = useState(prefillFields?.renegotiation_trigger || "");
  const [body, setBody] = useState(prefillFields?.body || "");
  const [supportNeeded, setSupportNeeded] = useState(prefillFields?.support_needed || "");

  // Completeness (only shown when expanded)
  const filledOptional = [metric, renegotiationTrigger, body, supportNeeded].filter(s => s.trim()).length;

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
        renewed_from: prefillFields?.renewed_from || undefined,
      };

      const { data, error } = await supabase.rpc("create_agreement_with_version", {
        p_group_id: groupId,
        p_subject_person_id: personId,
        p_fields: fields as any,
        p_created_by: user.id,
      });

      if (error) throw error;
      const newId = data as string;

      // If renewing, update the original agreement's renewed_as
      if (prefillFields?.renewed_from && newId) {
        await supabase
          .from("agreements")
          .update({ renewed_as: newId })
          .eq("id", prefillFields.renewed_from);
      }

      toast({ title: "Agreement created" });
      onCreated(newId);
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
        <CardTitle className="text-lg">{prefillFields?.renewed_from ? "Renew Agreement" : "New Agreement"}</CardTitle>
      </CardHeader>

      <CardContent>
        {prefillFields?.renewed_from && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 border px-3 py-2 mb-4 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 shrink-0" />
            Renewing a previous agreement. Adjust any fields as needed.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* === COMPACT SECTION: Always visible === */}

          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">Agreement name</Label>
            <Input
              id="title"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Medication check-in"
              className="text-base sm:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="i_will" className="text-xs">Commitment</Label>
            <Input
              id="i_will"
              required
              value={iWill}
              onChange={e => setIWill(e.target.value)}
              placeholder="I'll confirm I took my morning meds"
              className="text-base sm:text-sm"
            />
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <Label className="text-xs">Schedule</Label>
            {/* Row 1: Frequency + optional time */}
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
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {cadence.frequency !== "custom" && (
                <div className="flex-1">
                  <Input
                    type="time"
                    className="w-full h-9 text-base sm:text-sm"
                    value={cadence.time || ""}
                    onChange={e => setCadence(prev => ({ ...prev, time: e.target.value }))}
                    placeholder="Time"
                  />
                </div>
              )}
            </div>

            {/* Row 2: Duration */}
            <div className="flex gap-2">
              <Select
                value={duration.type}
                onValueChange={(val) => setDuration(prev => ({
                  ...prev,
                  type: val as DurationValue["type"],
                  days: val === "fixed" ? (prev.days || 30) : undefined,
                }))}
              >
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed duration</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="until_review">Until review</SelectItem>
                </SelectContent>
              </Select>

              {duration.type === "fixed" && (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    className="w-16 h-9 text-base sm:text-sm"
                    value={duration.days || 30}
                    onChange={e => setDuration(prev => ({ ...prev, days: parseInt(e.target.value) || 30 }))}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">days</span>
                </div>
              )}
            </div>

            {/* Day picker for weekly */}
            {cadence.frequency === "weekly" && (
              <div className="flex gap-1">
                {DAY_OPTIONS.map((d, i) => (
                  <Button
                    key={`${d.value}-${i}`}
                    type="button"
                    size="sm"
                    variant={cadence.days?.includes(d.value) ? "default" : "outline"}
                    className="h-8 w-8 text-xs px-0"
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
                placeholder="e.g., every other Tuesday"
                className="text-base sm:text-sm"
              />
            )}
          </div>

          {/* === CREATE BUTTON === */}
          <Button type="submit" className="w-full" disabled={saving || !title.trim() || !iWill.trim()}>
            {saving ? "Creating…" : "Create Agreement"}
          </Button>

          {/* === EXPANDED SECTION: More options === */}
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-center py-1">
              <Settings2 className="h-3 w-3" />
              {expanded ? "Fewer options" : "More options"}
              {!expanded && filledOptional > 0 && (
                <span className="text-muted-foreground">({filledOptional} set)</span>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 pt-3">

              {/* Check-in method */}
              <div className="space-y-1.5">
                <Label className="text-xs">Check-in method</Label>
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
                    placeholder="Describe check-in method"
                    className="mt-1"
                  />
                )}
              </div>

              {/* Metric */}
              <div className="space-y-1.5">
                <Label htmlFor="metric" className="text-xs">How we'll know it's happening</Label>
                <Input
                  id="metric"
                  value={metric}
                  onChange={e => setMetric(e.target.value)}
                  placeholder="e.g., Timeline note after each check-in"
                />
              </div>

              {/* Renegotiation trigger */}
              <div className="space-y-1.5">
                <Label htmlFor="renegotiation" className="text-xs">Revisit when</Label>
                <Input
                  id="renegotiation"
                  value={renegotiationTrigger}
                  onChange={e => setRenegotiationTrigger(e.target.value)}
                  placeholder="e.g., If 3 check-ins are missed in a row"
                />
              </div>

              {/* Support needed */}
              <div className="space-y-1.5">
                <Label htmlFor="support" className="text-xs">Team support</Label>
                <Textarea
                  id="support"
                  value={supportNeeded}
                  onChange={e => setSupportNeeded(e.target.value)}
                  placeholder="e.g., Mom sends a reminder at 11:45 AM"
                  rows={2}
                />
              </div>

              {/* Additional context */}
              <div className="space-y-1.5">
                <Label htmlFor="body" className="text-xs">Additional context</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Background, conditions, notes…"
                  rows={2}
                />
              </div>

              {/* Completeness indicator — only in expanded view */}
              <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Agreement strength</span>
                  <span className={`text-xs font-medium ${
                    filledOptional === 0 ? "text-muted-foreground" :
                    filledOptional <= 1 ? "text-amber-500" :
                    filledOptional <= 2 ? "text-blue-500" : "text-green-500"
                  }`}>
                    {filledOptional === 0 ? "Basic" :
                     filledOptional <= 1 ? "Good" :
                     filledOptional <= 2 ? "Strong" : "Comprehensive"}
                  </span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full transition-all"
                    style={{ width: `${Math.max(25, ((2 + filledOptional) / 6) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Core fields filled. Optional details make agreements easier to track and review.
                </p>
              </div>

            </CollapsibleContent>
          </Collapsible>

        </form>
      </CardContent>
    </Card>
  );
}
