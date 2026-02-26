import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createAlertIfNeeded } from "@/lib/alertsService";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Circle,
  Clock,
  ClipboardCheck,
  Pencil,
  XCircle,
  RefreshCw,
  History,
  X,
} from "lucide-react";
import {
  formatCadenceDisplay,
  formatDurationDisplay,
  type VersionFields,
  type ClosureData,
  type AgreementStatus,
  PERSON_ASSESSMENT_OPTIONS,
} from "@/types/agreements";
import { checkPermission } from "@/lib/checkPermission";
import { PLAN_LABELS } from "@/lib/planLabels";

// ─── Props ───────────────────────────────────────────────
interface Props {
  agreementId: string;
  groupId: string;
  personId?: string;
  onBack: () => void;
  onStartReview?: (agreementId: string) => void;
}

// ─── Status Config ───────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  proposed: {
    label: "Proposed — awaiting response",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Clock className="h-4 w-4" />,
  },
  accepted: {
    label: "Active",
    className: "bg-green-50 text-green-700 border-green-200",
    icon: <CheckCircle className="h-4 w-4" />,
  },
  declined: {
    label: "Declined",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: <XCircle className="h-4 w-4" />,
  },
  withdrawn: {
    label: "Withdrawn",
    className: "bg-muted text-muted-foreground border-border",
    icon: <Circle className="h-4 w-4" />,
  },
  review_needed: {
    label: "Review due",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  completed: {
    label: "Completed",
    className: "bg-green-50 text-green-700 border-green-200",
    icon: <ClipboardCheck className="h-4 w-4" />,
  },
  incomplete: {
    label: "Incomplete",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  lapsed: {
    label: "Lapsed",
    className: "bg-muted text-muted-foreground border-border",
    icon: <Clock className="h-4 w-4" />,
  },
};

// ─── Component ───────────────────────────────────────────
export default function AgreementDetail({
  agreementId,
  groupId,
  onBack,
  onStartReview,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Data
  const [agreement, setAgreement] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [acceptances, setAcceptances] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [personRecord, setPersonRecord] = useState<{user_id: string; label: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubjectPerson, setIsSubjectPerson] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [modFields, setModFields] = useState<VersionFields>({});

  // ─── Fetch ────────────────────────────────────────────
  async function fetchAll() {
    setLoading(true);
    try {
      const [agRes, verRes, accRes, memRes] = await Promise.all([
        supabase.from("agreements").select("*").eq("id", agreementId).single(),
        supabase
          .from("agreement_versions")
          .select("*")
          .eq("agreement_id", agreementId)
          .order("version_num", { ascending: false }),
        supabase
          .from("agreement_acceptances")
          .select("*")
          .eq("agreement_id", agreementId)
          .order("created_at", { ascending: false }),
        supabase
          .from("group_memberships")
          .select("user_id, role, display_name")
          .eq("group_id", groupId),
      ]);

      setAgreement(agRes.data);
      setVersions(verRes.data || []);
      setAcceptances(accRes.data || []);
      setMembers(memRes.data || []);

      // Check roles
      if (agRes.data && user) {
        const { data: person } = await supabase
          .from("persons")
          .select("user_id, label")
          .eq("id", agRes.data.subject_person_id)
          .single();
        if (person) setPersonRecord(person);
        setIsSubjectPerson(person?.user_id === user.id);

        const mem = (memRes.data || []).find(
          (m: any) => m.user_id === user.id
        );
        setIsCoordinator(mem?.role === "coordinator");
      }
    } catch (err) {
      console.error("Failed to fetch agreement:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, [agreementId]);

  // Derived
  const latestVersion = versions[0];
  const fields: VersionFields = (latestVersion?.fields as VersionFields) || {};
  const status: AgreementStatus = agreement?.status || "proposed";
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.proposed;
  const closure: ClosureData | null = (agreement as any)?.closure || null;

  const hasResponded = acceptances.some(
    (a: any) =>
      a.agreement_version_id === latestVersion?.id &&
      (a.status === "accepted" || a.status === "declined" || a.status === "modified")
  );
  const hasModifiedResponse = acceptances.some(
    (a: any) => a.agreement_version_id === latestVersion?.id && a.status === "modified"
  );

  // ─── Actions ──────────────────────────────────────────
  async function handleAccept() {
    if (!user || !latestVersion || !agreement) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("respond_to_agreement", {
        p_agreement_id: agreementId,
        p_version_id: latestVersion.id,
        p_group_id: groupId,
        p_response: "accepted",
      });
      if (error) throw error;

      toast({ title: "Commitment accepted" });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    if (!user || !latestVersion || !agreement) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("respond_to_agreement", {
        p_agreement_id: agreementId,
        p_version_id: latestVersion.id,
        p_group_id: groupId,
        p_response: "declined",
      });
      if (error) throw error;

      await createAlertIfNeeded({
        group_id: groupId,
        subject_person_id: agreement.subject_person_id,
        type: "agreement_declined",
        severity: "tier2",
        title: `Agreement declined: ${fields.title || "Untitled"}`,
        source_table: "agreement_acceptances",
        source_id: agreementId,
      });

      toast({ title: "Commitment declined" });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw() {
    if (!user || !agreement) return;
    setSubmitting(true);
    try {
      await supabase
        .from("agreements")
        .update({ status: "withdrawn" })
        .eq("id", agreementId);

      await createAlertIfNeeded({
        group_id: groupId,
        subject_person_id: agreement.subject_person_id,
        type: "agreement_declined",
        severity: "tier3",
        title: `Agreement withdrawn: ${fields.title || "Untitled"}`,
        source_table: "agreements",
        source_id: agreementId,
      });

      toast({ title: "Commitment withdrawn" });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitModification(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !latestVersion || !agreement) return;
    setSubmitting(true);
    try {
      const perms = await checkPermission(user.id, groupId, agreement.subject_person_id);
      if (!perms.isSubjectPerson && !perms.isMember) {
        toast({ title: "Permission denied", variant: "destructive" });
        return;
      }

      const nextVersionNum = latestVersion.version_num + 1;
      const submitFields = { ...modFields };
      if (submitFields.cadence && typeof submitFields.cadence === "object") {
        submitFields.cadence_or_due_date = formatCadenceDisplay(submitFields);
      }

      const { data: newV, error: vErr } = await supabase
        .from("agreement_versions")
        .insert([
          {
            agreement_id: agreementId,
            group_id: groupId,
            proposed_by_user_id: user.id,
            version_num: nextVersionNum,
            fields: submitFields as any,
          },
        ])
        .select("id")
        .single();
      if (vErr) throw vErr;

      // If subject person is modifying, also insert an acceptance record
      if (isSubjectPerson && newV) {
        await supabase.from("agreement_acceptances").insert({
          agreement_version_id: newV.id,
          agreement_id: agreementId,
          group_id: groupId,
          person_user_id: user.id,
          status: "modified",
        });
      }

      // Move back to proposed if it was accepted or declined
      if (status === "accepted" || status === "declined") {
        await supabase
          .from("agreements")
          .update({ status: "proposed" })
          .eq("id", agreementId);
      }

      await createAlertIfNeeded({
        group_id: groupId,
        subject_person_id: agreement.subject_person_id,
        type: "agreement_modified",
        severity: "tier2",
        title: `${isSubjectPerson ? "Modification proposed" : "New proposal"}: ${submitFields.title || fields.title || "Untitled"}`,
        source_table: "agreements",
        source_id: agreementId,
      });

      toast({ title: isSubjectPerson ? "Modification submitted" : "Update proposed" });
      setModifying(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Helpers ──────────────────────────────────────────
  function memberName(userId: string): string {
    const m = members.find((m: any) => m.user_id === userId);
    if (m?.display_name) return m.display_name;
    if (personRecord && personRecord.user_id === userId) return personRecord.label;
    return "Team member";
  }

  function startModify(prefill?: VersionFields) {
    const source = prefill || fields;
    setModFields({
      ...source,
      cadence_or_due_date: source.cadence
        ? formatCadenceDisplay(source)
        : source.cadence_or_due_date || "",
    });
    setModifying(true);
  }

  // ─── Render ───────────────────────────────────────────
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!agreement || versions.length === 0) {
    return <p className="text-sm text-muted-foreground">Commitment not found.</p>;
  }

  const isTerminal = ["declined", "withdrawn", "completed", "lapsed"].includes(status);

  return (
    <div className="space-y-4">
      {/* Back */}
      <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      {/* ── Status Banner ── */}
      <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${statusConfig.className}`}>
        {statusConfig.icon}
        {statusConfig.label}
      </div>

      {/* ── Agreement Card ── */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* Title */}
          <div>
            <h2 className="text-lg font-semibold">{fields.title || "Untitled Commitment"}</h2>
            {versions.length > 1 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Version {latestVersion.version_num} · Last updated by {memberName(latestVersion.proposed_by_user_id)}
              </p>
            )}
          </div>

          {/* ── Structured Fields ── */}
          <div className="space-y-3">
            {fields.i_will_statement && (
              <div>
                <span className="text-xs text-muted-foreground block">{PLAN_LABELS.personSection}</span>
                <span className="text-sm italic">"{fields.i_will_statement}"</span>
              </div>
            )}

            {fields.team_commitment && (
              <div>
                <span className="text-xs text-muted-foreground block">{PLAN_LABELS.teamSection}</span>
                <span className="text-sm">{fields.team_commitment}</span>
              </div>
            )}

            {fields.guardrails && (
              <div>
                <span className="text-xs text-muted-foreground block">{PLAN_LABELS.guardrailsSection}</span>
                <span className="text-sm">{fields.guardrails}</span>
              </div>
            )}

            {(fields.cadence || fields.cadence_or_due_date) && (
              <div>
                <span className="text-xs text-muted-foreground block">Schedule</span>
                <span className="text-sm">{formatCadenceDisplay(fields)}</span>
              </div>
            )}

            {fields.duration && (
              <div>
                <span className="text-xs text-muted-foreground block">Duration</span>
                <span className="text-sm">{formatDurationDisplay(fields)}</span>
              </div>
            )}

            {fields.metric_definition && (
              <div>
                <span className="text-xs text-muted-foreground block">How we'll know</span>
                <span className="text-sm">{fields.metric_definition}</span>
              </div>
            )}

            {fields.check_in_method && (
              <div>
                <span className="text-xs text-muted-foreground block">Check-in method</span>
                <span className="text-sm">{fields.check_in_method.replace(/_/g, " ")}</span>
              </div>
            )}

            {fields.support_needed && (
              <div>
                <span className="text-xs text-muted-foreground block">Team support</span>
                <span className="text-sm">{fields.support_needed}</span>
              </div>
            )}

            {fields.renegotiation_trigger && (
              <div>
                <span className="text-xs text-muted-foreground block">Revisit when</span>
                <span className="text-sm">{fields.renegotiation_trigger}</span>
              </div>
            )}

            {fields.body && (
              <div>
                <span className="text-xs text-muted-foreground block">Additional context</span>
                <span className="text-sm whitespace-pre-wrap">{fields.body}</span>
              </div>
            )}

            {fields.renewed_from && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3" />
                Renewed from a previous commitment
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Closure Summary ── */}
      {closure && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              {statusConfig.icon}
              <span className="text-sm font-medium">
                 {status === "completed" ? "Commitment completed" :
                  status === "incomplete" ? "Commitment incomplete" :
                  "Commitment lapsed"}
              </span>
              {closure.early_close && (
                <Badge variant="outline" className="text-xs">
                  Early — {closure.days_active} of {closure.days_planned} days
                </Badge>
              )}
            </div>
            {closure.compliance_estimate != null && (
              <p className="text-sm text-muted-foreground">
                Check-ins logged: {Math.round(closure.compliance_estimate * 100)}%
              </p>
            )}
            {closure.person_assessment && (
              <p className="text-sm text-muted-foreground">
                Person's assessment: {PERSON_ASSESSMENT_OPTIONS.find(o => o.value === closure.person_assessment)?.emoji}{" "}
                {PERSON_ASSESSMENT_OPTIONS.find(o => o.value === closure.person_assessment)?.label}
              </p>
            )}
            {closure.reflection && (
              <p className="text-sm italic text-muted-foreground">"{closure.reflection}"</p>
            )}
            {closure.renewed_as && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Renewed as a new commitment
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Actions ── */}
      {!modifying && (
        <div className="space-y-3">
          {/* Subject Person: Respond to proposal */}
          {isSubjectPerson && status === "proposed" && !hasResponded && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm">This commitment is waiting for your response.</p>
                <div className="grid grid-cols-1 gap-2">
                   <Button className="h-12 text-base" onClick={handleAccept} disabled={submitting}>
                     <CheckCircle className="mr-2 h-5 w-5" /> {PLAN_LABELS.accept}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                     <Button variant="outline" className="h-11" onClick={() => startModify()} disabled={submitting}>
                       <Pencil className="mr-2 h-4 w-4" /> {PLAN_LABELS.modify}
                     </Button>
                     <Button variant="outline" className="h-11 text-destructive hover:text-destructive" onClick={handleDecline} disabled={submitting}>
                       <XCircle className="mr-2 h-4 w-4" /> {PLAN_LABELS.decline}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Coordinator: Accept modification from person */}
          {isCoordinator && !isSubjectPerson && hasModifiedResponse && !isTerminal && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm text-muted-foreground">The person has proposed modifications to this commitment.</p>
                <div className="flex gap-2">
                  <Button onClick={async () => {
                    setSubmitting(true);
                    try {
                      await supabase.from("agreements").update({
                        current_version_id: latestVersion.id,
                        status: "accepted",
                      }).eq("id", agreementId);
                      toast({ title: "Modification accepted" });
                      fetchAll();
                    } catch (err: any) {
                      toast({ title: "Error", description: err.message, variant: "destructive" });
                    } finally { setSubmitting(false); }
                  }} disabled={submitting}>
                    <CheckCircle className="mr-1.5 h-4 w-4" /> Accept as Active
                  </Button>
                  <Button variant="outline" onClick={() => startModify()} disabled={submitting}>
                    <Pencil className="mr-1.5 h-4 w-4" /> Counter-Propose
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Coordinator: Active agreement actions */}
          {isCoordinator && !isSubjectPerson && status === "accepted" && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => startModify()}>
                <Pencil className="mr-1.5 h-4 w-4" /> Propose Changes
              </Button>
              {onStartReview && (
                <Button variant="outline" size="sm" onClick={() => onStartReview(agreementId)}>
                  <ClipboardCheck className="mr-1.5 h-4 w-4" /> Close Early / Review
                </Button>
              )}
            </div>
          )}

          {/* Coordinator: Review needed */}
          {isCoordinator && !isSubjectPerson && status === "review_needed" && onStartReview && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">This commitment is due for review.</span>
                </div>
                <Button onClick={() => onStartReview(agreementId)}>
                  <ClipboardCheck className="mr-1.5 h-4 w-4" /> Start Review
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Coordinator: Re-open declined */}
          {isCoordinator && !isSubjectPerson && status === "declined" && (
            <Card>
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm text-muted-foreground">This commitment was declined. You can propose a revised version.</p>
                <Button variant="outline" size="sm" onClick={() => startModify()}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Propose Revised Version
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Coordinator: Accept or Withdraw proposed */}
          {isCoordinator && !isSubjectPerson && status === "proposed" && (
            <div className="space-y-2">
              <Button
                size="sm"
                onClick={handleAccept}
                disabled={submitting}
              >
                <CheckCircle className="mr-1.5 h-4 w-4" /> Accept as Active
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleWithdraw}
                disabled={submitting}
              >
                <X className="mr-1 h-4 w-4" /> Withdraw Commitment
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Modification Form ── */}
      {modifying && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmitModification} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  {isSubjectPerson ? "Propose modifications" : "Propose updated terms"}
                </h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => setModifying(false)}>
                  Cancel
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Commitment name</Label>
                <Input
                  value={modFields.title || ""}
                  onChange={(e) => setModFields((f) => ({ ...f, title: e.target.value }))}
                  className="text-base sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Commitment</Label>
                <Input
                  value={modFields.i_will_statement || ""}
                  onChange={(e) => setModFields((f) => ({ ...f, i_will_statement: e.target.value }))}
                  className="text-base sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Schedule</Label>
                <Input
                  value={modFields.cadence_or_due_date || ""}
                  onChange={(e) => setModFields((f) => ({ ...f, cadence_or_due_date: e.target.value }))}
                  placeholder="e.g., Daily at noon"
                  className="text-base sm:text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Edit the schedule as text. e.g., "Daily at noon" or "Weekly on Mon, Wed, Fri at 10 AM"
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">How we'll know it's happening</Label>
                <Input
                  value={modFields.metric_definition || ""}
                  onChange={(e) => setModFields((f) => ({ ...f, metric_definition: e.target.value }))}
                  className="text-base sm:text-sm"
                />
              </div>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <ChevronDown className="h-3 w-3" />
                  More fields
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Check-in method</Label>
                    <Input
                      value={modFields.check_in_method || ""}
                      onChange={(e) => setModFields((f) => ({ ...f, check_in_method: e.target.value }))}
                      className="text-base sm:text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Team support</Label>
                    <Textarea
                      value={modFields.support_needed || ""}
                      onChange={(e) => setModFields((f) => ({ ...f, support_needed: e.target.value }))}
                      rows={2}
                      className="text-base sm:text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Revisit when</Label>
                    <Input
                      value={modFields.renegotiation_trigger || ""}
                      onChange={(e) => setModFields((f) => ({ ...f, renegotiation_trigger: e.target.value }))}
                      className="text-base sm:text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Additional context</Label>
                    <Textarea
                      value={modFields.body || ""}
                      onChange={(e) => setModFields((f) => ({ ...f, body: e.target.value }))}
                      rows={2}
                      className="text-base sm:text-sm"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Proposal"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Version History ── */}
      {versions.length > 1 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <History className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
            {versions.length} versions · {acceptances.length} responses
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 pl-4 border-l-2 border-muted">
            {versions.map((v: any) => {
              const vFields = v.fields as VersionFields;
              return (
                <div key={v.id} className="py-2 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs">
                      v{v.version_num} · {memberName(v.proposed_by_user_id)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {vFields.i_will_statement && (
                    <p className="text-xs text-muted-foreground">
                      "{vFields.i_will_statement}"
                      {vFields.cadence
                        ? ` · ${formatCadenceDisplay(vFields)}`
                        : vFields.cadence_or_due_date
                        ? ` · ${vFields.cadence_or_due_date}`
                        : ""}
                    </p>
                  )}
                  {isCoordinator && !isSubjectPerson && v.version_num < latestVersion.version_num && !modifying && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-6 px-2"
                      onClick={() => startModify(vFields)}
                    >
                      Use as basis for new proposal
                    </Button>
                  )}
                </div>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ── Response History ── */}
      {acceptances.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3 w-3" />
            Response history
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1 pl-4 border-l-2 border-muted">
            {acceptances.map((a: any) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground py-1">
                <span className={`font-medium ${
                  a.status === "accepted" ? "text-green-600" :
                  a.status === "declined" ? "text-destructive" :
                  a.status === "self_assessed" ? "text-blue-600" :
                  "text-amber-600"
                }`}>
                  {a.status === "self_assessed" ? "Self-assessment" : a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                </span>
                <span>by {memberName(a.person_user_id)}</span>
                {a.message && <span className="italic">— "{a.message}"</span>}
                <span className="ml-auto">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
