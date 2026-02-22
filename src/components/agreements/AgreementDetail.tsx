import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, Pencil } from "lucide-react";

interface VersionFields {
  title?: string;
  i_will_statement?: string;
  metric_definition?: string;
  cadence_or_due_date?: string;
  check_in_method?: string;
  support_needed?: string;
  renegotiation_trigger?: string;
}

interface Props {
  agreementId: string;
  groupId: string;
  onBack: () => void;
}

export default function AgreementDetail({ agreementId, groupId, onBack }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [agreement, setAgreement] = useState<any>(null);
  const [latestVersion, setLatestVersion] = useState<any>(null);
  const [acceptances, setAcceptances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubjectPerson, setIsSubjectPerson] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);

  // modify mode
  const [modifying, setModifying] = useState(false);
  const [modFields, setModFields] = useState<VersionFields>({});
  const [modMessage, setModMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [aRes, vRes, accRes] = await Promise.all([
      supabase.from("agreements").select("*").eq("id", agreementId).single(),
      supabase.from("agreement_versions").select("*").eq("agreement_id", agreementId).order("version_num", { ascending: false }).limit(1),
      supabase.from("agreement_acceptances").select("*").eq("agreement_id", agreementId).order("created_at", { ascending: false }),
    ]);
    setAgreement(aRes.data);
    const v = vRes.data?.[0] ?? null;
    setLatestVersion(v);
    setAcceptances(accRes.data ?? []);

    // check if current user is the subject person
    if (aRes.data && user) {
      const { data: person } = await supabase
        .from("persons")
        .select("user_id")
        .eq("id", aRes.data.subject_person_id)
        .single();
      setIsSubjectPerson(person?.user_id === user.id);

      // check coordinator
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
      const { error } = await supabase.from("agreement_acceptances").insert({
        agreement_version_id: latestVersion.id,
        agreement_id: agreementId,
        group_id: groupId,
        person_user_id: user.id,
        status: "accepted",
      });
      if (error) throw error;

      // coordinator auto-sets current_version_id if current user is also coordinator
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
      const { data: acc, error } = await supabase.from("agreement_acceptances").insert({
        agreement_version_id: latestVersion.id,
        agreement_id: agreementId,
        group_id: groupId,
        person_user_id: user.id,
        status: "declined",
      }).select("id").single();
      if (error) throw error;

      // Best-effort alert
      if (acc) {
        await supabase.from("alerts").insert({
          group_id: groupId,
          subject_person_id: agreement.subject_person_id,
          created_by_user_id: user.id,
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
      // insert new version
      const newVersionNum = latestVersion.version_num + 1;
      const { data: newV, error: vErr } = await supabase.from("agreement_versions").insert([{
        agreement_id: agreementId,
        group_id: groupId,
        proposed_by_user_id: user.id,
        version_num: newVersionNum,
        fields: modFields as any,
      }]).select("id").single();
      if (vErr) throw vErr;

      // insert acceptance as modified
      const { data: acc, error: aErr } = await supabase.from("agreement_acceptances").insert({
        agreement_version_id: newV.id,
        agreement_id: agreementId,
        group_id: groupId,
        person_user_id: user.id,
        status: "modified",
        message: modMessage || null,
      }).select("id").single();
      if (aErr) throw aErr;

      // Best-effort alert
      if (acc) {
        await supabase.from("alerts").insert({
          group_id: groupId,
          subject_person_id: agreement.subject_person_id,
          created_by_user_id: user.id,
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
  if (!agreement || !latestVersion) return <p className="text-sm text-muted-foreground">Agreement not found.</p>;

  const fields = latestVersion.fields as VersionFields;
  const hasAcceptance = acceptances.some(a => a.agreement_version_id === latestVersion.id && a.status === "accepted");

  const fieldEntries: { label: string; key: keyof VersionFields }[] = [
    { label: "I will…", key: "i_will_statement" },
    { label: "Metric", key: "metric_definition" },
    { label: "Cadence / Due", key: "cadence_or_due_date" },
    { label: "Check-in", key: "check_in_method" },
    { label: "Support Needed", key: "support_needed" },
    { label: "Renegotiation", key: "renegotiation_trigger" },
  ];

  return (
    <Card>
      <CardHeader>
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">{fields.title || "Untitled"}</CardTitle>
          <Badge variant={agreement.status === "accepted" ? "default" : "secondary"}>{agreement.status}</Badge>
          <span className="text-xs text-muted-foreground">v{latestVersion.version_num}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fields display */}
        <div className="space-y-2">
          {fieldEntries.map(({ label, key }) => (
            <div key={key}>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="text-sm">{fields[key] || "—"}</p>
            </div>
          ))}
        </div>

        {/* Acceptance history */}
        {acceptances.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Responses</p>
            <ul className="space-y-1">
              {acceptances.map(a => (
                <li key={a.id} className="flex items-center gap-2 text-xs">
                  <Badge variant={a.status === "accepted" ? "default" : "outline"} className="text-xs">{a.status}</Badge>
                  {a.message && <span className="text-muted-foreground">— {a.message}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions for supported person */}
        {isSubjectPerson && agreement.status === "proposed" && !hasAcceptance && !modifying && (
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

        {/* Modify form */}
        {modifying && (
          <form onSubmit={handleModify} className="space-y-3 border-t pt-3">
            <p className="text-sm font-medium">Propose modifications</p>
            {fieldEntries.map(({ label, key }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                {key === "i_will_statement" || key === "support_needed" ? (
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
