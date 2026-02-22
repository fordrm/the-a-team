import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createAlertIfNeeded } from "@/lib/alertsService";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const TYPES = ["triangulation", "agreement_dispute", "timeline_conflict", "other"] as const;
const SEVERITIES = ["low", "medium", "high"] as const;

interface NoteOption { id: string; body: string; occurred_at: string; }
interface AgreementOption { id: string; title: string; }

interface Props {
  groupId: string;
  personId: string;
  onBack: () => void;
  onCreated: () => void;
}

export default function CreateContradiction({ groupId, personId, onBack, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState("triangulation");
  const [severity, setSeverity] = useState("medium");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");

  const [notes, setNotes] = useState<NoteOption[]>([]);
  const [agreements, setAgreements] = useState<AgreementOption[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [selectedAgreementIds, setSelectedAgreementIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchRelated = async () => {
      const [nRes, aRes] = await Promise.all([
        supabase
          .from("contact_notes")
          .select("id, body, occurred_at")
          .eq("group_id", groupId)
          .eq("subject_person_id", personId)
          .order("occurred_at", { ascending: false })
          .limit(30),
        supabase
          .from("agreements")
          .select("id")
          .eq("group_id", groupId)
          .eq("subject_person_id", personId),
      ]);
      setNotes(nRes.data ?? []);
      // fetch latest version titles for agreements
      const agrs = aRes.data ?? [];
      const withTitles: AgreementOption[] = [];
      for (const a of agrs) {
        const { data: vd } = await supabase
          .from("agreement_versions")
          .select("fields")
          .eq("agreement_id", a.id)
          .order("version_num", { ascending: false })
          .limit(1);
        const fields = vd?.[0]?.fields as any;
        withTitles.push({ id: a.id, title: fields?.title || "Untitled" });
      }
      setAgreements(withTitles);
    };
    fetchRelated();
  }, [groupId, personId]);

  const toggleNote = (id: string) => {
    setSelectedNoteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleAgreement = (id: string) => {
    setSelectedAgreementIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { data: inserted, error } = await supabase.from("contradictions").insert({
        group_id: groupId,
        subject_person_id: personId,
        created_by_user_id: user.id,
        type,
        severity,
        summary,
        details: details || null,
        related_note_ids: selectedNoteIds,
        related_agreement_ids: selectedAgreementIds,
      }).select("id").single();
      if (error) throw error;

      // Centralized alert generation with dedupe
      if (inserted) {
        await createAlertIfNeeded({
          group_id: groupId,
          subject_person_id: personId,
          type: "contradiction_opened",
          severity: "tier2",
          title: `Contradiction flagged: ${summary.slice(0, 80)}`,
          body: details || null,
          source_table: "contradictions",
          source_id: inserted.id,
        });
      }

      toast({ title: "Contradiction flagged" });
      onCreated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader>
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <CardTitle className="text-lg">Flag Contradiction</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Summary</Label>
            <Input required value={summary} onChange={e => setSummary(e.target.value)} placeholder="Brief description of the contradiction" />
          </div>

          <div className="space-y-2">
            <Label>Details (optional)</Label>
            <Textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Full context…" rows={3} />
          </div>

          {notes.length > 0 && (
            <div className="space-y-2">
              <Label>Related Notes</Label>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border p-2">
                {notes.map(n => (
                  <label key={n.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted rounded p-1">
                    <Checkbox checked={selectedNoteIds.includes(n.id)} onCheckedChange={() => toggleNote(n.id)} className="mt-0.5" />
                    <div>
                      <span className="text-xs text-muted-foreground">{new Date(n.occurred_at).toLocaleString()}</span>
                      <p className="line-clamp-1">{n.body}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {agreements.length > 0 && (
            <div className="space-y-2">
              <Label>Related Agreements</Label>
              <div className="space-y-1 rounded-md border p-2">
                {agreements.map(a => (
                  <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted rounded p-1">
                    <Checkbox checked={selectedAgreementIds.includes(a.id)} onCheckedChange={() => toggleAgreement(a.id)} />
                    <span>{a.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Submit Contradiction"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
