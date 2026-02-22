import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

interface AlertRow {
  id: string;
  title: string;
  body: string | null;
  type: string;
  severity: string;
  status: string;
  source_table: string | null;
  source_id: string | null;
  acknowledged_by_user_id: string | null;
  acknowledged_at: string | null;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

interface Props {
  alertId: string;
  groupId: string;
  isCoordinator: boolean;
  onBack: () => void;
  onNavigateSource?: (table: string, id: string) => void;
}

export default function AlertDetail({ alertId, groupId, isCoordinator, onBack, onNavigateSource }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [item, setItem] = useState<AlertRow | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*")
        .eq("id", alertId)
        .single();
      if (data) setItem(data as AlertRow);
    };
    fetch();
  }, [alertId]);

  const handleAcknowledge = async () => {
    if (!item || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("alerts").update({
        status: "acknowledged",
        acknowledged_by_user_id: user.id,
        acknowledged_at: new Date().toISOString(),
      }).eq("id", item.id);
      if (error) throw error;
      setItem({ ...item, status: "acknowledged", acknowledged_by_user_id: user.id, acknowledged_at: new Date().toISOString() });
      toast({ title: "Alert acknowledged" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleResolve = async (status: "resolved" | "dismissed") => {
    if (!item || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("alerts").update({
        status,
        resolved_by_user_id: user.id,
        resolved_at: new Date().toISOString(),
        resolution_note: resolutionNote || null,
      }).eq("id", item.id);
      if (error) throw error;
      setItem({ ...item, status, resolved_by_user_id: user.id, resolved_at: new Date().toISOString(), resolution_note: resolutionNote || null });
      toast({ title: `Alert ${status}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (!item) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <Card>
      <CardHeader>
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <CardTitle className="text-lg">{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{item.type.replace(/_/g, " ")}</Badge>
          <Badge>{item.severity}</Badge>
          <Badge variant={item.status === "open" ? "destructive" : "secondary"}>{item.status}</Badge>
        </div>

        {item.body && <p className="text-sm">{item.body}</p>}

        <div className="text-xs text-muted-foreground">
          Created: {new Date(item.created_at).toLocaleString()}
          {item.acknowledged_at && <span className="ml-3">Acknowledged: {new Date(item.acknowledged_at).toLocaleString()}</span>}
          {item.resolved_at && <span className="ml-3">Resolved: {new Date(item.resolved_at).toLocaleString()}</span>}
        </div>

        {item.resolution_note && (
          <div>
            <Label className="text-xs text-muted-foreground">Resolution Note</Label>
            <p className="text-sm mt-1">{item.resolution_note}</p>
          </div>
        )}

        {/* Source link */}
        {item.source_table && item.source_id && onNavigateSource && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateSource(item.source_table!, item.source_id!)}
          >
            View {item.source_table.replace(/_/g, " ")}
          </Button>
        )}

        {/* Coordinator actions */}
        {isCoordinator && item.status === "open" && (
          <div className="border-t pt-4">
            <Button size="sm" onClick={handleAcknowledge} disabled={saving}>
              Acknowledge
            </Button>
          </div>
        )}

        {isCoordinator && (item.status === "open" || item.status === "acknowledged") && (
          <div className="border-t pt-4 space-y-3">
            <Label>Resolution Note (optional)</Label>
            <Textarea
              value={resolutionNote}
              onChange={e => setResolutionNote(e.target.value)}
              placeholder="Add resolution context…"
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleResolve("resolved")} disabled={saving}>
                Resolve
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleResolve("dismissed")} disabled={saving}>
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
