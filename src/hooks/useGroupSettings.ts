import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GroupSettings {
  id: string;
  group_id: string;
  operating_mode: "collaborative" | "coordinated" | "crisis";
  default_note_visibility: string;
  indicator_input_mode: "self_report_primary" | "observer_primary" | "dual";
  plan_authorship: "mutual" | "team_proposes" | "person_proposes";
  sharing_model: "person_pushes" | "team_realtime" | "hybrid";
  focused_period_ack: "active_consent" | "notification" | "auto";
  updated_at: string;
}

export function useGroupSettings(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-settings", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const { data, error } = await (supabase as any)
        .from("group_settings")
        .select("*")
        .eq("group_id", groupId)
        .maybeSingle();
      if (error) throw error;
      return data as GroupSettings | null;
    },
    enabled: !!groupId,
  });
}
