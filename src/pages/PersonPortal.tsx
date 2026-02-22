import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { signOutAndReset } from "@/lib/signOut";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, LogOut } from "lucide-react";

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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [personInfo, setPersonInfo] = useState<PersonInfo | null>(null);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [versions, setVersions] = useState<Record<string, AgreementVersion>>({});
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }

    // Check if current user is a supported person in any group
    const checkPersonStatus = async () => {
      const { data: persons } = await supabase
        .from("persons")
        .select("id, label, group_id")
        .eq("user_id", user.id);

      if (!persons || persons.length === 0) {
        setChecking(false);
        return;
      }

      const person = persons[0];
      // Get group name
      const { data: group } = await supabase
        .from("groups")
        .select("name")
        .eq("id", person.group_id)
        .single();

      setPersonInfo({
        ...person,
        group_name: group?.name ?? "Unknown Group",
      });

      // Fetch shared notes (RLS will filter to shared_with_person only)
      const { data: notesData } = await supabase
        .from("contact_notes")
        .select("id, body, occurred_at, channel")
        .eq("group_id", person.group_id)
        .eq("subject_person_id", person.id)
        .order("occurred_at", { ascending: false });
      setNotes(notesData ?? []);

      // Fetch agreements for this person
      const { data: agreementsData } = await supabase
        .from("agreements")
        .select("id, status, created_at, current_version_id")
        .eq("group_id", person.group_id)
        .eq("subject_person_id", person.id)
        .order("created_at", { ascending: false });
      setAgreements(agreementsData ?? []);

      // Fetch current versions
      if (agreementsData && agreementsData.length > 0) {
        const versionIds = agreementsData
          .map((a) => a.current_version_id)
          .filter(Boolean) as string[];
        if (versionIds.length > 0) {
          const { data: versionsData } = await supabase
            .from("agreement_versions")
            .select("id, fields, version_num")
            .in("id", versionIds);
          const vMap: Record<string, AgreementVersion> = {};
          (versionsData ?? []).forEach((v: any) => {
            vMap[v.id] = v;
          });
          setVersions(vMap);
        }
      }

      setChecking(false);
    };

    checkPersonStatus();
  }, [user, loading, navigate]);

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
            <CardTitle>No Group Access</CardTitle>
            <CardDescription>
              You haven't been linked to any support group yet. Ask your coordinator to approve your access request.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="ghost" size="sm" onClick={() => signOutAndReset()}>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Portal</h1>
            <p className="text-sm text-muted-foreground">
              {personInfo.label} — {personInfo.group_name}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOutAndReset()}>
            <LogOut className="mr-1 h-4 w-4" /> Sign Out
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This space shows only items explicitly shared with you. Some coordination notes remain internal to your support team.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="notes">
          <TabsList className="w-full">
            <TabsTrigger value="notes" className="flex-1">Shared Notes</TabsTrigger>
            <TabsTrigger value="agreements" className="flex-1">My Agreements</TabsTrigger>
          </TabsList>

          <TabsContent value="notes">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Shared Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No shared notes yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {notes.map((n) => (
                      <li key={n.id} className="rounded-md border px-3 py-2">
                        <p className="text-sm">{n.body}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(n.occurred_at).toLocaleDateString()}
                          {n.channel && ` · ${n.channel}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agreements">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">My Agreements</CardTitle>
              </CardHeader>
              <CardContent>
                {agreements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No agreements yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {agreements.map((a) => {
                      const version = a.current_version_id ? versions[a.current_version_id] : null;
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
                            Created {new Date(a.created_at).toLocaleDateString()}
                            {version && ` · v${version.version_num}`}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
