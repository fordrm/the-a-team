import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus } from "lucide-react";
import type { VersionFields } from "@/types/agreements";
import { formatCadenceDisplay, formatDurationDisplay } from "@/types/agreements";

interface AgreementRow {
  id: string;
  subject_person_id: string;
  created_by_user_id: string;
  status: string;
  current_version_id: string | null;
  created_at: string;
}

interface VersionRow {
  id: string;
  agreement_id: string;
  version_num: number;
  fields: VersionFields;
  proposed_by_user_id: string;
  created_at: string;
}

interface Props {
  groupId: string;
  personId: string | null;
  onCreateNew: () => void;
  onViewAgreement: (agreementId: string) => void;
  isGroupMember?: boolean;
}

export default function AgreementsList({ groupId, personId, onCreateNew, onViewAgreement, isGroupMember = true }: Props) {
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [versions, setVersions] = useState<Record<string, VersionRow>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) { setAgreements([]); setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("agreements")
        .select("id, subject_person_id, created_by_user_id, status, current_version_id, created_at")
        .eq("group_id", groupId)
        .eq("subject_person_id", personId);
      if (error) {
        console.error("AgreementsList fetch error:", error);
        setLoading(false);
        return;
      }
      const items = data ?? [];
      setAgreements(items);

      // Batch fetch all versions for these agreements in one query (M-6)
      const versionMap: Record<string, VersionRow> = {};
      if (items.length > 0) {
        const agreementIds = items.map(a => a.id);
        const { data: allVersions, error: vError } = await supabase
          .from("agreement_versions")
          .select("id, agreement_id, version_num, fields, proposed_by_user_id, created_at")
          .in("agreement_id", agreementIds)
          .order("version_num", { ascending: false });

        if (!vError && allVersions) {
          // Keep only the latest version per agreement
          for (const v of allVersions) {
            if (!versionMap[v.agreement_id]) {
              versionMap[v.agreement_id] = v as VersionRow;
            }
          }
        }
      }
      setVersions(versionMap);
      setLoading(false);
    };
    fetch();
  }, [groupId, personId]);

  if (!personId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-medium text-sm">Choose a supported person</p>
          <p className="text-sm text-muted-foreground mt-1">Select who you're coordinating for to view their agreements.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading agreements…</p>;

  const statusColor = (s: string) => {
    if (s === "accepted") return "default";
    if (s === "proposed") return "secondary";
    return "outline";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" /> Agreements
        </CardTitle>
        {isGroupMember && (
          <Button size="sm" variant="outline" onClick={onCreateNew} disabled={!personId}>
            <Plus className="mr-1 h-4 w-4" /> New Agreement
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {agreements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agreements yet.</p>
        ) : (
          <ul className="space-y-2">
            {agreements.map(a => {
              const v = versions[a.id];
              const fields = v?.fields as VersionFields | undefined;
              return (
                <li
                  key={a.id}
                  onClick={() => onViewAgreement(a.id)}
                  className="flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{fields?.title || "Untitled"}</span>
                      {v && <span className="text-xs text-muted-foreground shrink-0">v{v.version_num}</span>}
                    </div>
                    {fields?.i_will_statement && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        "{fields.i_will_statement}"
                        {fields.cadence ? ` · ${formatCadenceDisplay(fields)}` : fields.cadence_or_due_date ? ` · ${fields.cadence_or_due_date}` : ""}
                        {fields.duration ? ` · ${formatDurationDisplay(fields)}` : ""}
                      </p>
                    )}
                  </div>
                  <Badge variant={statusColor(a.status)}>{a.status}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
