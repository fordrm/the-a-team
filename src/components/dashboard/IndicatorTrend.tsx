import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrendingUp, ChevronDown } from "lucide-react";
import { INDICATOR_LABEL_MAP, INDICATOR_CATEGORIES } from "@/lib/indicators";

const CATEGORY_BAR_COLORS: Record<string, string> = {
  psychosis: "bg-purple-400",
  mood_manic: "bg-orange-400",
  mood_depressive: "bg-blue-400",
  functional: "bg-amber-400",
  relational: "bg-red-400",
};

function getBarColor(key: string): string {
  for (const cat of INDICATOR_CATEGORIES) {
    if (cat.indicators.some(i => i.key === key)) {
      return CATEGORY_BAR_COLORS[cat.id] || "bg-muted";
    }
  }
  return "bg-muted";
}

interface Props {
  groupId: string;
  personId: string | null;
}

export default function IndicatorTrend({ groupId, personId }: Props) {
  const [notes, setNotes] = useState<{ indicators: Record<string, boolean>; occurred_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return sessionStorage.getItem(`indicatorTrend_open_${groupId}`) !== "false";
    } catch { return true; }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(`indicatorTrend_open_${groupId}`, String(isOpen));
    } catch {}
  }, [isOpen, groupId]);

  useEffect(() => {
    if (!personId) { setNotes([]); setLoading(false); return; }

    const fetchNotes = async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - parseInt(days));

      const { data } = await supabase
        .from("contact_notes")
        .select("indicators, occurred_at")
        .eq("group_id", groupId)
        .eq("subject_person_id", personId)
        .gte("occurred_at", since.toISOString());

      setNotes((data as any[]) ?? []);
      setLoading(false);
    };

    fetchNotes();
  }, [groupId, personId, days]);

  const ranked = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const note of notes) {
      if (!note.indicators) continue;
      for (const [key, val] of Object.entries(note.indicators)) {
        if (val) counts[key] = (counts[key] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [notes]);

  if (!personId) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" /> Indicator Trends
              {!isOpen && ranked.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  {ranked.length} indicator{ranked.length !== 1 ? "s" : ""} flagged in {days}d
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {isOpen && (
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger className="w-24 h-8 text-xs" onClick={e => e.stopPropagation()}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : ranked.length === 0 ? (
              <p className="text-sm text-muted-foreground">No indicators flagged in the last {days} days.</p>
            ) : (
              <div className="space-y-2">
                {ranked.map(([key, count]) => {
                  const label = INDICATOR_LABEL_MAP[key] || key.replace(/_/g, " ");
                  const maxCount = ranked[0][1] as number;
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{label}</span>
                        <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                          {count}×
                        </Badge>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getBarColor(key)} opacity-70`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground pt-1">
                  Based on {notes.length} note{notes.length !== 1 ? "s" : ""} in the last {days} days
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
