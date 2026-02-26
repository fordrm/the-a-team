import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Lock, ChevronDown } from "lucide-react";
import { SELF_REPORT_LABELS } from "@/lib/selfReportLabels";
import { INDICATOR_CATEGORY_MAP, getIndicatorBadgeColor } from "@/lib/indicators";

interface MyCheckInsProps {
  personId: string;
  groupId: string;
  refreshKey: number;
}

interface CheckIn {
  id: string;
  body: string;
  indicators: Record<string, boolean>;
  created_at: string;
  shared_snapshot_exists: boolean;
}

export default function MyCheckIns({ personId, groupId, refreshKey }: MyCheckInsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(10);
  const [hasMore, setHasMore] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState<string | null>(null);

  const fetchCheckIns = async () => {
    if (!user) return;
    const { data: notes } = await (supabase as any)
      .from("contact_notes")
      .select("id, body, indicators, created_at")
      .eq("group_id", groupId)
      .eq("subject_person_id", personId)
      .eq("author_user_id", user.id)
      .eq("source", "self_report")
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    const fetched = notes || [];
    setHasMore(fetched.length > limit);
    const display = fetched.slice(0, limit);

    // Check which have been shared
    if (display.length > 0) {
      const ids = display.map(n => n.id);
      const { data: snapshots } = await (supabase as any)
        .from("contact_notes")
        .select("shared_from_id")
        .eq("source", "shared_snapshot")
        .in("shared_from_id", ids);

      const sharedSet = new Set((snapshots || []).map((s: any) => s.shared_from_id));
      setCheckIns(display.map(n => ({
        ...n,
        indicators: (n.indicators || {}) as Record<string, boolean>,
        shared_snapshot_exists: sharedSet.has(n.id),
      })));
    } else {
      setCheckIns([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCheckIns(); }, [user, groupId, personId, refreshKey, limit]);

  const handleShare = async (checkIn: CheckIn) => {
    if (!user) return;
    setSharing(checkIn.id);
    try {
      const { error } = await (supabase as any)
        .from("contact_notes")
        .insert({
          group_id: groupId,
          subject_person_id: personId,
          author_user_id: user.id,
          body: checkIn.body,
          indicators: checkIn.indicators,
          visibility_tier: "shared_with_person",
          source: "shared_snapshot",
          channel: "shared_snapshot",
          consent_level: "self_reported",
          shared_from_id: checkIn.id,
        });
      if (error) throw error;
      toast({ title: "Shared with your team" });
      fetchCheckIns();
    } catch (err: any) {
      toast({ title: "Error sharing", description: err.message, variant: "destructive" });
    } finally {
      setSharing(null);
    }
  };

  const formatRelativeDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (days === 0) return `Today at ${time}`;
    if (days === 1) return `Yesterday at ${time}`;
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const activeIndicators = (ind: Record<string, boolean>) =>
    Object.entries(ind).filter(([, v]) => v).map(([k]) => k);

  if (loading) return null;
  if (checkIns.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">My Check-Ins</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {checkIns.map(ci => {
          const expanded = expandedIds.has(ci.id);
          const indKeys = activeIndicators(ci.indicators);
          const bodyPreview = ci.body.length > 120 && !expanded
            ? ci.body.slice(0, 120) + "…"
            : ci.body;

          return (
            <div key={ci.id} className="rounded-md border px-3 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{formatRelativeDate(ci.created_at)}</p>
                <div className="flex items-center gap-1.5">
                  {ci.shared_snapshot_exists ? (
                    <Badge variant="outline" className="text-xs">Shared</Badge>
                  ) : (
                    <>
                      <Lock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Private</span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{bodyPreview}</p>
              {ci.body.length > 120 && !expanded && (
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setExpandedIds(prev => new Set(prev).add(ci.id))}
                >
                  Show more
                </button>
              )}
              {indKeys.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {indKeys.map(k => (
                    <Badge key={k} variant="outline" className={`text-xs ${getIndicatorBadgeColor(k)}`}>
                      {SELF_REPORT_LABELS[k] || k}
                    </Badge>
                  ))}
                </div>
              )}
              {!ci.shared_snapshot_exists && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleShare(ci)}
                  disabled={sharing === ci.id}
                >
                  <Send className="mr-1 h-3 w-3" />
                  {sharing === ci.id ? "Sharing…" : "Share with Team"}
                </Button>
              )}
            </div>
          );
        })}
        {hasMore && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setLimit(prev => prev + 10)}
          >
            <ChevronDown className="mr-1 h-4 w-4" /> Show more
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
