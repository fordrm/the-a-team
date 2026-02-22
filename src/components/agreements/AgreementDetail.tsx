import { useEffect, useState } from "react";
import { formatDate } from "@/lib/formatDate";
import { supabase } from "@/integrations/supabase/client";
import { createAlertIfNeeded } from "@/lib/alertsService";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, Pencil, ChevronDown, History, X } from "lucide-react";
import { checkPermission } from "@/lib/checkPermission";

interface VersionFields {
  title?: string;
  body?: string;
  i_will_statement?: string;
  metric_definition?: string;
  cadence_or_due_date?: string;
  check_in_method?: string;
  support_needed?: string;
  renegotiation_trigger?: string;
}

interface VersionRow {
  id: string;
  version_num: number;
  fields: VersionFields;
  proposed_by_user_id: string;
  created_at: string;
}

interface Props {
  agreementId: string;
  groupId: string;
  onBack: () => void;
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "accepted": return "default";
    case "proposed": return "secondary";
    case "declined": return "destructive";
    case "withdrawn": return "outline";
    default: return "secondary";
  }
}

export default function AgreementDetail({ agreementId, groupId, onBack }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [agreement, setAgreement] = useState<any>(null);
  const [allVersions, setAllVersions] = useState<VersionRow[]>([]);
  const [acceptances, setAcceptances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubjectPerson, setIsSubjectPerson] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);

  // modify mode (supported person)
  const [modifying, setModifying] = useState(false);
  const [modFields, setModFields] = useState<VersionFields>({});
  const [modMessage, setModMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // propose update mode (coordinator/supporter)
  const [proposing, setProposing] = useState(false);
  const [proposeFields, setProposeFields] = useState<VersionFields>({});

  // version history
  const [historyOpen, setHistoryOpen] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [aRes, vRes, accRes] = await Promise.all([
      supabase.from("agreements").select("*").eq("id", agreementId).single(),
      supabase.from("agreement_versions").select("*").eq("agreement_id", agreementId).order("version_num", { ascending: false }),
      supabase.from("agreement_acceptances").select("*").eq("agreement_id", agreementId).order("created_at", { ascending: false }),
    ]);
    setAgreement(aRes.data);
    setAllVersions((vRes.data ?? []) as VersionRow[]);
    setAcceptances(accRes.data ?? []);

    // check if current user is the subject person
    if (aRes.data && user) {
      const { data: person } = await supabase
        .from("persons")
        .select("user_id")
        .eq("id", aRes.data.subject_person_id)
        .single();
      setIsSubjectPerson(person?.user_id === user.id);

      const { data: mem } = await supabase
        .from("group_memberships")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      setIsCoordinator(mem?.role === "coordinator");
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [agreementId]);

  const handleAccept = async () => {
    if (!user || !latestVersion) return;
    setSubmitting(true);
    try {
      const perms = await checkPermission(user.id, groupId, agreement?.subject_person_id);
      if (!perms.isSubjectPerson && !perms.isMember) {
        toast({ title: "Permission denied", description: "Your access may have changed. Please refresh.", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      const { error } = await supabase.from("agreement_acceptances").insert({
        agreement_version_id: latestVersion.id,
        agreement_id: agreementId,
        group_id: groupId,
        person_user_id: user.id,
        status: "accepted",
      });
      if (error) throw error;

      if (isCoordinator) {
        await supabase.from("agreements").update({
          current_version_id: latestVersion.id,
          status: "accepted",
        }).eq("id", agreementId);
      }

      toast({ title: "Agreement accepted" });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!user || !latestVersion || !agreement) return;
    setSubmitting(true);
    try {
      const perms = await checkPermission(user.id, groupId, agreement?.subject_person_id);
      if (!perms.isSubjectPerson && !perms.isMember) {
        toast({ title: "Permission denied", description: "Your access may have changed. Please refresh.", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      const { data: acc, error } = await supabase.from("agreement_acceptances").insert({
        agreement_version_id: latestVersion.id,
        agreement_id: agreementId,
        group_id: groupId,
        person_user_id: user.id,
        status: "declined",
      }).select("id").single();
      if (error) throw error;

      // Update agreement status to declined
      await supabase.from("agreements").update({ status: "declined" }).eq("id", agreementId);

      if (acc) {
        await createAlertIfNeeded({
          group_id: groupId,
          subject_person_id: agreement.subject_person_id,
          type: "agreement_declined",
          severity: "tier2",
          title: `Agreement declined: ${(latestVersion.fields as any)?.title || "Untitled"}`,
          source_table: "agreement_acceptances",
          source_id: acc.id,
        });
      }

      toast({ title: "Agreement declined" });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleModify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !latestVersion || !agreement) return;
    setSubmitting(true);
    try {
      const perms = await checkPermission(user.id, groupId, agreement?.subject_person_id);
      if (!perms.isSubjectPerson && !perms.isMember) {
        toast({ title: "Permission denied", description: "Your access may have changed. Please refresh.", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      const newVersionNum = latestVersion.version_num + 1;
      const { data: newV, error: vErr } = await supabase.from("agreement_versions").insert([{
        agreement_id: agreementId,
        group_id: groupId,
        proposed_by_user_id: user.id,
        version_num: newVersionNum,
        fields: modFields as any,
      }]).select("id").single();
      if (vErr) throw vErr;

      const { data: acc, error: aErr } = await supabase.from("agreement_acceptances").insert({
        agreement_version_id: newV.id,
        agreement_id: agreementId,
        group_id: groupId,
        person_user_id: user.id,
        status: "modified",
        message: modMessage || null,
      }).select("id").single();
      if (aErr) throw aErr;

      if (acc) {
        await createAlertIfNeeded({
          group_id: groupId,
          subject_person_id: agreement.subject_person_id,
          type: "agreement_modified",
          severity: "tier2",
          title: `Agreement modified: ${modFields.title || "Untitled"}`,
          source_table: "agreement_acceptances",
          source_id: acc.id,
        });
      }

      toast({ title: "Modification submitted" });
      setModifying(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!agreement || allVersions.length === 0) return <p className="text-sm text-muted-foreground">Agreement not found.</p>;

  const latestVersion = allVersions[0];
  const olderVersions = allVersions.slice(1);
  const fields = latestVersion.fields as VersionFields;
  const hasAcceptance = acceptances.some(a => a.agreement_version_id === latestVersion.id && a.status === "accepted");
  const hasModifiedResponse = acceptances.some(a => a.agreement_version_id === latestVersion.id && a.status === "modified");
  const hasAnyResponse = acceptances.some(a => a.agreement_version_id === latestVersion.id);
  const isTerminal = agreement.status === "declined" || agreement.status === "withdrawn";

  const fieldEntries: { label: string; key: keyof VersionFields }[] = [
    { label: "Terms", key: "body" },
    { label: "I will…", key: "i_will_statement" },
    { label: "Metric", key: "metric_definition" },
    { label: "Cadence / Due", key: "cadence_or_due_date" },
    { label: "Check-in", key: "check_in_method" },
    { label: "Support Needed", key: "support_needed" },
    { label: "Renegotiation", key: "renegotiation_trigger" },
  ];

  // Only show fields that have values
  const activeFields = fieldEntries.filter(({ key }) => fields[key]);

  return (
    <Card>
      <CardHeader>
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">{fields.title || "Untitled"}</CardTitle>
          <Badge variant={getStatusVariant(agreement.status)}>{agreement.status}</Badge>
          <span className="text-xs text-muted-foreground">v{latestVersion.version_num}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Response prompt for subject person */}
        {isSubjectPerson && agreement.status === "proposed" && !hasAcceptance && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
            This agreement is waiting for your response. You can accept it as-is, propose modifications, or decline.
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Current Version</p>
          <div className="space-y-2">
            {activeFields.length > 0 ? activeFields.map(({ label, key }) => (
              <div key={key}>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="text-sm whitespace-pre-wrap">{fields[key]}</p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No content in this version.</p>
            )}
          </div>
        </div>

        {/* Version History */}
        {olderVersions.length > 0 && (
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border-t pt-3 w-full">
              <History className="h-3 w-3" />
              <ChevronDown className={`h-3 w-3 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              Version History ({olderVersions.length} older)
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              {olderVersions.map(v => {
                const vFields = v.fields as VersionFields;
                const vActiveFields = fieldEntries.filter(({ key }) => vFields[key]);
                return (
                  <div key={v.id} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">v{v.version_num}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(v.created_at)}</span>
                    </div>
                    {vActiveFields.map(({ label, key }) => (
                      <div key={key}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-xs whitespace-pre-wrap">{vFields[key]}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Acceptance history */}
        {acceptances.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Responses</p>
            <ul className="space-y-1">
              {acceptances.map(a => (
                <li key={a.id} className="flex items-center gap-2 text-xs">
                  <Badge variant={a.status === "accepted" ? "default" : a.status === "declined" ? "destructive" : "outline"} className="text-xs">{a.status}</Badge>
                  {a.message && <span className="text-muted-foreground">— {a.message}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions for supported person */}
        {isSubjectPerson && agreement.status === "proposed" && !hasAnyResponse && !modifying && (
          <div className="flex gap-2 border-t pt-3">
            <Button size="sm" onClick={handleAccept} disabled={submitting}>
              <Check className="mr-1 h-4 w-4" /> Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              setModFields({ ...fields });
              setModifying(true);
            }}>
              <Pencil className="mr-1 h-4 w-4" /> Modify
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDecline} disabled={submitting}>
              Decline
            </Button>
          </div>
        )}

        {/* Coordinator: set accepted version */}
        {isCoordinator && !isSubjectPerson && hasAcceptance && agreement.current_version_id !== latestVersion.id && (
          <div className="border-t pt-3">
            <Button size="sm" onClick={async () => {
              await supabase.from("agreements").update({
                current_version_id: latestVersion.id,
                status: "accepted",
              }).eq("id", agreementId);
              toast({ title: "Version confirmed" });
              fetchAll();
            }}>
              Confirm as Current Version
            </Button>
          </div>
        )}

        {/* Coordinator: accept modification from supported person */}
        {isCoordinator && !isSubjectPerson && hasModifiedResponse && !proposing && !isTerminal && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-sm text-muted-foreground">The supported person proposed a modification to this agreement.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={async () => {
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
                <Check className="mr-1 h-4 w-4" /> Accept Modification
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                setProposeFields({ ...fields });
                setProposing(true);
              }}>
                <Pencil className="mr-1 h-4 w-4" /> Counter-Propose
              </Button>
            </div>
            {/* Revert to a previous version */}
            {olderVersions.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Or revert to a previous version:</p>
                <div className="flex flex-wrap gap-1">
                  {olderVersions.map(v => (
                    <Button
                      key={v.id}
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={() => {
                        setProposeFields({ ...(v.fields as VersionFields) });
                        setProposing(true);
                      }}
                    >
                      Revert to v{v.version_num}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Coordinator/Supporter: Propose Update */}
        {!isSubjectPerson && !proposing && !isTerminal && !hasModifiedResponse && (
          <div className="border-t pt-3">
            <Button size="sm" variant="outline" onClick={() => {
              setProposeFields({ ...fields });
              setProposing(true);
            }}>
              <Pencil className="mr-1 h-4 w-4" /> Propose Update
            </Button>
          </div>
        )}

        {/* Coordinator: Re-open declined agreement */}
        {isCoordinator && !isSubjectPerson && agreement.status === "declined" && !proposing && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-sm text-muted-foreground">This agreement was declined. You can propose a revised version to re-open negotiation.</p>
            <Button size="sm" variant="outline" onClick={() => {
              setProposeFields({ ...fields });
              setProposing(true);
            }}>
              <Pencil className="mr-1 h-4 w-4" /> Propose Revised Version
            </Button>
          </div>
        )}

        {/* Coordinator: Withdraw agreement */}
        {isCoordinator && !isSubjectPerson && !isTerminal && agreement.status !== "accepted" && (
          <div className="border-t pt-3">
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={async () => {
                setSubmitting(true);
                try {
                  await supabase.from("agreements").update({ status: "withdrawn" }).eq("id", agreementId);
                  await createAlertIfNeeded({
                    group_id: groupId,
                    subject_person_id: agreement.subject_person_id,
                    type: "agreement_declined",
                    severity: "tier3",
                    title: `Agreement withdrawn: ${fields.title || "Untitled"}`,
                    source_table: "agreements",
                    source_id: agreementId,
                  });
                  toast({ title: "Agreement withdrawn" });
                  fetchAll();
                } catch (err: any) {
                  toast({ title: "Error", description: err.message, variant: "destructive" });
                } finally { setSubmitting(false); }
              }}
              disabled={submitting}
            >
              <X className="mr-1 h-4 w-4" /> Withdraw Agreement
            </Button>
          </div>
        )}

        {/* Full counter-propose / propose update form */}
        {proposing && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!user) return;
            setSubmitting(true);
            try {
              const nextVersionNum = latestVersion.version_num + 1;
              const { error: vErr } = await supabase.from("agreement_versions").insert([{
                agreement_id: agreementId,
                group_id: groupId,
                proposed_by_user_id: user.id,
                version_num: nextVersionNum,
                fields: proposeFields as any,
              }]);
              if (vErr) throw vErr;

              // Re-open if previously declined or accepted
              if (agreement.status === "declined" || agreement.status === "accepted") {
                await supabase.from("agreements").update({ status: "proposed" }).eq("id", agreementId);
              }

              await createAlertIfNeeded({
                group_id: groupId,
                subject_person_id: agreement.subject_person_id,
                type: "agreement_updated",
                severity: "tier3",
                title: `New proposal on: ${proposeFields.title || fields.title || "Untitled"}`,
                source_table: "agreements",
                source_id: agreementId,
              });

              toast({ title: "Update proposed" });
              setProposing(false);
              fetchAll();
            } catch (err: any) {
              toast({ title: "Error", description: err.message, variant: "destructive" });
            } finally { setSubmitting(false); }
          }} className="space-y-3 border-t pt-3">
            <p className="text-sm font-medium">Propose updated terms</p>
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input
                value={proposeFields.title || ""}
                onChange={e => setProposeFields(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            {fieldEntries.map(({ label, key }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                {key === "body" || key === "i_will_statement" || key === "support_needed" ? (
                  <Textarea
                    value={(proposeFields[key] as string) || ""}
                    onChange={e => setProposeFields(f => ({ ...f, [key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    value={(proposeFields[key] as string) || ""}
                    onChange={e => setProposeFields(f => ({ ...f, [key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Proposal"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setProposing(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {/* Modify form (supported person) */}
        {modifying && (
          <form onSubmit={handleModify} className="space-y-3 border-t pt-3">
            <p className="text-sm font-medium">Propose modifications</p>
            {fieldEntries.map(({ label, key }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                {key === "i_will_statement" || key === "support_needed" || key === "body" ? (
                  <Textarea
                    value={(modFields[key] as string) || ""}
                    onChange={e => setModFields(f => ({ ...f, [key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    value={(modFields[key] as string) || ""}
                    onChange={e => setModFields(f => ({ ...f, [key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input
                value={modFields.title || ""}
                onChange={e => setModFields(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Message (why modify?)</Label>
              <Textarea value={modMessage} onChange={e => setModMessage(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Modification"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setModifying(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
