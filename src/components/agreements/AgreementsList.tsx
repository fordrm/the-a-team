import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus } from "lucide-react";

interface AgreementRow {
  id: string;
  subject_person_id: string;
  created_by_user_id: string;
  status: string;
  current_version_id: string | null;
  created_at: string;
}

interface VersionFields {
  title?: string;
  i_will_statement?: string;
  metric_definition?: string;
  cadence_or_due_date?: string;
  check_in_method?: string;
  support_needed?: string;
  renegotiation_trigger?: string;
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
}

export default function AgreementsList({ groupId, personId, onCreateNew, onViewAgreement }: Props) {
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [versions, setVersions] = useState<Record<string, VersionRow>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) { setAgreements([]); setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("agreements")
        .select("id, subject_person_id, created_by_user_id, status, current_version_id, created_at")
        .eq("group_id", groupId)
        .eq("subject_person_id", personId);
      const items = data ?? [];
      setAgreements(items);

      // fetch latest version for each agreement
      const versionMap: Record<string, VersionRow> = {};
      for (const a of items) {
        const { data: vData } = await supabase
          .from("agreement_versions")
          .select("id, agreement_id, version_num, fields, proposed_by_user_id, created_at")
          .eq("agreement_id", a.id)
          .order("version_num", { ascending: false })
          .limit(1);
        if (vData?.[0]) versionMap[a.id] = vData[0] as VersionRow;
      }
      setVersions(versionMap);
      setLoading(false);
    };
    fetch();
  }, [groupId, personId]);

  if (!personId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Select a supported person to view agreements.
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
        <Button size="sm" variant="outline" onClick={onCreateNew}>
          <Plus className="mr-1 h-4 w-4" /> New Agreement
        </Button>
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
                  <div>
                    <span className="font-medium">{fields?.title || "Untitled"}</span>
                    {v && <span className="ml-2 text-xs text-muted-foreground">v{v.version_num}</span>}
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
