import { useEffect, useState } from "react";
import { formatDate } from "@/lib/formatDate";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { signOutAndReset } from "@/lib/signOut";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, LogOut, Pencil, HelpCircle, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PersonInfo {
  id: string;
  label: string;
  group_id: string;
  group_name: string;
}

interface ContactNote {
  id: string;
  body: string;
  occurred_at: string;
  channel: string | null;
}

interface Agreement {
  id: string;
  status: string;
  created_at: string;
  current_version_id: string | null;
}

interface AgreementVersion {
  id: string;
  fields: Record<string, unknown>;
  version_num: number;
}

export default function PersonPortal() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [personInfo, setPersonInfo] = useState<PersonInfo | null>(null);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [versions, setVersions] = useState<Record<string, AgreementVersion>>({});
  const [checking, setChecking] = useState(true);

  // Edit label
  const [editLabelOpen, setEditLabelOpen] = useState(false);
  const [editLabelValue, setEditLabelValue] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);

  // Explainer modal
  const [explainerOpen, setExplainerOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }

    const checkPersonStatus = async () => {
      const { data: persons } = await supabase
        .from("persons")
        .select("id, label, group_id")
        .eq("user_id", user.id);

      if (!persons || persons.length === 0) {
        // Not a supported person — check if they're a group member (coordinator/supporter)
        const { data: membership } = await supabase
          .from("group_memberships")
          .select("group_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1);

        if (membership && membership.length > 0) {
          navigate(`/group/${membership[0].group_id}`, { replace: true });
          return;
        }

        // No person record and no membership — genuinely awaiting link
        setChecking(false);
        return;
      }

      const person = persons[0];
      const { data: group } = await supabase
        .from("groups")
        .select("name")
        .eq("id", person.group_id)
        .single();

      setPersonInfo({
        ...person,
        group_name: group?.name ?? "Unknown Group",
      });

      const { data: notesData } = await supabase
        .from("contact_notes")
        .select("id, body, occurred_at, channel")
        .eq("group_id", person.group_id)
        .eq("subject_person_id", person.id)
        .order("occurred_at", { ascending: false });
      setNotes(notesData ?? []);

      const { data: agreementsData } = await supabase
        .from("agreements")
        .select("id, status, created_at, current_version_id")
        .eq("group_id", person.group_id)
        .eq("subject_person_id", person.id)
        .order("created_at", { ascending: false });
      setAgreements(agreementsData ?? []);

      if (agreementsData && agreementsData.length > 0) {
        const vMap: Record<string, AgreementVersion> = {};

        // Fetch versions for agreements with current_version_id set
        const versionIds = agreementsData
          .map((a) => a.current_version_id)
          .filter(Boolean) as string[];
        if (versionIds.length > 0) {
          const { data: versionsData } = await supabase
            .from("agreement_versions")
            .select("id, fields, version_num")
            .in("id", versionIds);
          (versionsData ?? []).forEach((v: any) => {
            vMap[v.id] = v;
          });
        }

        // Fallback: for agreements without current_version_id, fetch latest version
        const missingVersionAgreements = agreementsData.filter(
          (a) => !a.current_version_id
        );
        for (const a of missingVersionAgreements) {
          const { data: latestVersion } = await supabase
            .from("agreement_versions")
            .select("id, fields, version_num")
            .eq("agreement_id", a.id)
            .order("version_num", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (latestVersion) {
            vMap[`fallback-${a.id}`] = latestVersion as unknown as AgreementVersion;
          }
        }

        setVersions(vMap);
      }

      setChecking(false);
    };

    checkPersonStatus();
  }, [user, loading, navigate]);

  const handleSaveLabel = async () => {
    if (!personInfo) return;
    setSavingLabel(true);
    try {
      const { error } = await supabase
        .from("persons")
        .update({ label: editLabelValue.trim() })
        .eq("id", personInfo.id);
      if (error) throw error;
      setPersonInfo({ ...personInfo, label: editLabelValue.trim() });
      toast({ title: "Name updated" });
      setEditLabelOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingLabel(false);
    }
  };

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!personInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Awaiting link from your care organizer</CardTitle>
            <CardDescription>
              Your account is verified but you haven't been linked to a support team yet. Your care organizer will connect you shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1 h-4 w-4" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-2xl font-bold">My Portal</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                {personInfo.label} — {personInfo.group_name}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary"
                  onClick={() => { setEditLabelValue(personInfo.label); setEditLabelOpen(true); }}
                  title="Edit my name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1 h-4 w-4" /> Sign Out
          </Button>
        </div>

        {/* Status Banner */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          <span className="text-muted-foreground">Status: <span className="text-foreground font-medium">Connected to your support team</span></span>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This space shows only items explicitly shared with you. Some coordination notes remain internal to your support team.
          </AlertDescription>
        </Alert>

        {/* Section 1: Shared Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shared Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm font-medium">Nothing shared yet</p>
                <p className="text-sm text-muted-foreground mt-1">Your support team hasn't shared any notes with you yet. When they do, they'll appear here.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-md border px-3 py-2">
                    <p className="text-sm">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(n.occurred_at)}
                      {n.channel && ` · ${n.channel}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Section 2: My Agreements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My Agreements</CardTitle>
          </CardHeader>
          <CardContent>
            {agreements.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm font-medium">No agreements yet</p>
                <p className="text-sm text-muted-foreground mt-1">Agreements shared with you will appear here for review and acceptance.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {agreements.map((a) => {
                  const version = a.current_version_id
                    ? versions[a.current_version_id]
                    : versions[`fallback-${a.id}`] ?? null;
                  const fields = version?.fields as Record<string, string> | undefined;
                  return (
                    <li key={a.id} className="rounded-md border px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {fields?.title || fields?.summary || `Agreement`}
                        </p>
                        <Badge variant={a.status === "active" ? "default" : "secondary"}>
                          {a.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Created {formatDate(a.created_at)}
                        {version && ` · v${version.version_num}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Why am I seeing this? */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setExplainerOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Why am I seeing this?
          </button>
        </div>

        {/* Explainer Modal */}
        <Dialog open={explainerOpen} onOpenChange={setExplainerOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>About this portal</DialogTitle></DialogHeader>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>You were invited by a support team coordinating care with you.</li>
              <li>You only see items they explicitly share with you.</li>
              <li>Some internal coordination notes are not visible here.</li>
              <li>If something looks wrong, contact your care organizer.</li>
            </ul>
            <div className="flex justify-end mt-2">
              <Button variant="outline" size="sm" onClick={() => setExplainerOpen(false)}>Got it</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Label Dialog */}
        <Dialog open={editLabelOpen} onOpenChange={setEditLabelOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit My Name</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={editLabelValue} onChange={e => setEditLabelValue(e.target.value)} placeholder="Your name or alias" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditLabelOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveLabel} disabled={savingLabel || !editLabelValue.trim()}>{savingLabel ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
