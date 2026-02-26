import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { SELF_REPORT_CATEGORIES } from "@/lib/selfReportLabels";

interface MyTrendsProps {
  personId: string;
  groupId: string;
  refreshKey: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  mood_energy: "hsl(25, 95%, 53%)",
  sleep_daily: "hsl(38, 92%, 50%)",
  thoughts_perceptions: "hsl(270, 50%, 60%)",
  connections: "hsl(0, 72%, 51%)",
};

export default function MyTrends({ personId, groupId, refreshKey }: MyTrendsProps) {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: notes } = await (supabase as any)
        .from("contact_notes")
        .select("indicators, created_at")
        .eq("group_id", groupId)
        .eq("subject_person_id", personId)
        .eq("author_user_id", user.id)
        .eq("source", "self_report")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      if (!notes || notes.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Build weekly buckets
      const weekMap = new Map<string, Record<string, number>>();
      const catKeyMap: Record<string, string> = {};
      SELF_REPORT_CATEGORIES.forEach(cat => {
        cat.indicators.forEach(ind => {
          catKeyMap[ind.key] = cat.id;
        });
      });

      notes.forEach((note: any) => {
        const d = new Date(note.created_at);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const weekKey = weekStart.toISOString().split("T")[0];

        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, {
            mood_energy: 0,
            sleep_daily: 0,
            thoughts_perceptions: 0,
            connections: 0,
          });
        }
        const bucket = weekMap.get(weekKey)!;
        const indicators = (note.indicators || {}) as Record<string, boolean>;
        Object.entries(indicators).forEach(([key, val]) => {
          if (val && catKeyMap[key]) {
            bucket[catKeyMap[key]]++;
          }
        });
      });

      const chartData = Array.from(weekMap.entries()).map(([week, counts]) => {
        const d = new Date(week + "T00:00:00");
        return {
          week: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          ...counts,
        };
      });

      setData(chartData);
      setLoading(false);
    })();
  }, [user, groupId, personId, refreshKey]);

  if (loading || data.length === 0) return null;

  const chartConfig = {
    mood_energy: { label: "Mood & Energy", color: CATEGORY_COLORS.mood_energy },
    sleep_daily: { label: "Sleep & Daily Life", color: CATEGORY_COLORS.sleep_daily },
    thoughts_perceptions: { label: "Thoughts & Perceptions", color: CATEGORY_COLORS.thoughts_perceptions },
    connections: { label: "Connections", color: CATEGORY_COLORS.connections },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your patterns this month</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="mood_energy" stackId="a" fill={CATEGORY_COLORS.mood_energy} radius={[0, 0, 0, 0]} />
            <Bar dataKey="sleep_daily" stackId="a" fill={CATEGORY_COLORS.sleep_daily} />
            <Bar dataKey="thoughts_perceptions" stackId="a" fill={CATEGORY_COLORS.thoughts_perceptions} />
            <Bar dataKey="connections" stackId="a" fill={CATEGORY_COLORS.connections} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartContainer>
        <div className="flex flex-wrap gap-3 mt-3 justify-center">
          {SELF_REPORT_CATEGORIES.map(cat => (
            <div key={cat.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: CATEGORY_COLORS[cat.id] }}
              />
              {cat.label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
