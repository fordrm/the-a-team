import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const CHANNELS = ["call", "text", "in-person", "video", "other"] as const;
const VISIBILITY_TIERS = [
  { value: "shared_with_person", label: "Shared with person" },
  { value: "supporters_only", label: "Supporters only" },
  { value: "restricted", label: "Restricted (coordinators)" },
] as const;

const INDICATOR_KEYS = [
  { key: "triangulation_claim_unlogged_agreement", label: "Triangulation: claim of unlogged agreement" },
  { key: "triangulation_pressure_secret", label: "Triangulation: pressure to keep secret" },
  { key: "conflict_tone_high", label: "Conflict tone high" },
  { key: "suspiciousness_high", label: "Suspiciousness high" },
  { key: "sleep_reduced", label: "Sleep reduced" },
  { key: "disorganization_high", label: "Disorganization high" },
] as const;

interface Props {
  groupId: string;
  personId: string;
  onBack: () => void;
  onCreated: () => void;
}

export default function AddNote({ groupId, personId, onBack, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [occurredAt, setOccurredAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [channel, setChannel] = useState<string>("");
  const [visibility, setVisibility] = useState("supporters_only");
  const [body, setBody] = useState("");
  const [indicators, setIndicators] = useState<Record<string, boolean>>({});

  const toggleIndicator = (key: string) => {
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("contact_notes").insert({
        group_id: groupId,
        subject_person_id: personId,
        author_user_id: user.id,
        visibility_tier: visibility,
        consent_level: "supporter_reported",
        channel: channel || null,
        occurred_at: new Date(occurredAt).toISOString(),
        indicators,
        body,
      });
      if (error) throw error;
      toast({ title: "Note added" });
      onCreated();
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
        <CardTitle className="text-lg">Add Contact Note</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>When did this occur?</Label>
<Input
              type="datetime-local"
              value={occurredAt}
              onChange={e => setOccurredAt(e.target.value)}
              max={new Date().toISOString().slice(0, 16)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
              <SelectContent>
                {CHANNELS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISIBILITY_TIERS.map(v => (
                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea required value={body} onChange={e => setBody(e.target.value)} placeholder="What happened?" rows={4} />
          </div>

          <div className="space-y-2">
            <Label>Indicators</Label>
            <div className="space-y-2">
              {INDICATOR_KEYS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">{label}</span>
                  <Switch checked={!!indicators[key]} onCheckedChange={() => toggleIndicator(key)} />
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save Note"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
