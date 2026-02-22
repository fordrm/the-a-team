import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, UserPlus, Heart, LogOut, Clock, AlertTriangle, Activity, Bell } from "lucide-react";
import Timeline from "@/components/timeline/Timeline";
import AddNote from "@/components/timeline/AddNote";
import AgreementsList from "@/components/agreements/AgreementsList";
import CreateAgreement from "@/components/agreements/CreateAgreement";
import AgreementDetail from "@/components/agreements/AgreementDetail";
import ContradictionsList from "@/components/contradictions/ContradictionsList";
import CreateContradiction from "@/components/contradictions/CreateContradiction";
import ContradictionDetail from "@/components/contradictions/ContradictionDetail";
import InterventionsList from "@/components/interventions/InterventionsList";
import CreateIntervention from "@/components/interventions/CreateIntervention";
import InterventionDetail from "@/components/interventions/InterventionDetail";
import AlertsList from "@/components/alerts/AlertsList";
import AlertDetail from "@/components/alerts/AlertDetail";

interface GroupRow { id: string; name: string; }
interface MemberRow { id: string; user_id: string; role: string; display_name: string | null; is_active: boolean; }
interface PersonRow { id: string; label: string; is_primary: boolean; user_id: string | null; }

type AgreementView = { type: "list" } | { type: "create" } | { type: "detail"; agreementId: string };
type TimelineView = { type: "list" } | { type: "add" };
type ContradictionView = { type: "list" } | { type: "create" } | { type: "detail"; id: string };
type InterventionView = { type: "list" } | { type: "create" } | { type: "detail"; id: string };
type AlertView = { type: "list" } | { type: "detail"; id: string };

export default function GroupDashboard() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePersonId, setActivePersonId] = useState<string | null>(null);
  const [agreementView, setAgreementView] = useState<AgreementView>({ type: "list" });
  const [timelineView, setTimelineView] = useState<TimelineView>({ type: "list" });
  const [timelineKey, setTimelineKey] = useState(0);
  const [contradictionView, setContradictionView] = useState<ContradictionView>({ type: "list" });
  const [contradictionKey, setContradictionKey] = useState(0);
  const [interventionView, setInterventionView] = useState<InterventionView>({ type: "list" });
  const [interventionKey, setInterventionKey] = useState(0);
  const [alertView, setAlertView] = useState<AlertView>({ type: "list" });
  const [alertKey, setAlertKey] = useState(0);

  // invite form
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);

  // person form
  const [personLabel, setPersonLabel] = useState("");
  const [personUserId, setPersonUserId] = useState("");
  const [personOpen, setPersonOpen] = useState(false);
  const [creatingPerson, setCreatingPerson] = useState(false);

  const fetchData = async () => {
    if (!groupId) return;
    const [gRes, mRes, pRes] = await Promise.all([
      supabase.from("groups").select("id, name").eq("id", groupId).single(),
      supabase.from("group_memberships").select("id, user_id, role, display_name, is_active").eq("group_id", groupId).eq("is_active", true),
      supabase.from("persons").select("id, label, is_primary, user_id").eq("group_id", groupId),
    ]);
    if (gRes.error) {
      toast({ title: "Access denied", description: gRes.error.message, variant: "destructive" });
      navigate("/");
      return;
    }
    setGroup(gRes.data);
    setMembers(mRes.data ?? []);
    setPersons(pRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [groupId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;
    setInviting(true);
    try {
      const { error } = await supabase.from("group_memberships").insert({
        group_id: groupId, user_id: inviteUserId, role: inviteRole,
        display_name: inviteDisplayName || null, is_active: true, capabilities: {},
      });
      if (error) throw error;
      toast({ title: "Member added" });
      setInviteOpen(false); setInviteUserId(""); setInviteRole("member"); setInviteDisplayName("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setInviting(false); }
  };

  const handleCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;
    setCreatingPerson(true);
    try {
      const { error } = await supabase.from("persons").insert({
        group_id: groupId, label: personLabel, user_id: personUserId || null, is_primary: true,
      });
      if (error) throw error;
      toast({ title: "Person created" });
      setPersonOpen(false); setPersonLabel(""); setPersonUserId("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setCreatingPerson(false); }
  };

  // Derived: is current user the supported person for active person? Is coordinator?
  const isSubjectPerson = activePersonId ? persons.find(p => p.id === activePersonId)?.user_id === user?.id : false;
  const isCoordinator = members.some(m => m.user_id === user?.id && m.role === "coordinator");

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading…</p></div>;

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{group?.name}</h1>
            <p className="text-sm text-muted-foreground">Group Dashboard</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1 h-4 w-4" /> Sign Out
          </Button>
        </div>

        <Tabs defaultValue={isSubjectPerson ? "agreements" : "members"}>
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="w-max min-w-full">
              {!isSubjectPerson && <TabsTrigger value="members" className="text-xs sm:text-sm">Members</TabsTrigger>}
              {!isSubjectPerson && <TabsTrigger value="persons" className="text-xs sm:text-sm">Persons</TabsTrigger>}
              <TabsTrigger value="agreements" className="text-xs sm:text-sm">Agreements</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs sm:text-sm">{isSubjectPerson ? "Shared Notes" : "Timeline"}</TabsTrigger>
              {!isSubjectPerson && <TabsTrigger value="contradictions" className="text-xs sm:text-sm">Conflicts</TabsTrigger>}
              {!isSubjectPerson && <TabsTrigger value="interventions" className="text-xs sm:text-sm">Interventions</TabsTrigger>}
              {!isSubjectPerson && <TabsTrigger value="alerts" className="text-xs sm:text-sm">Alerts</TabsTrigger>}
            </TabsList>
          </div>

          {/* Members Tab */}
          {!isSubjectPerson && (
          <TabsContent value="members">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" /> Members
                </CardTitle>
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><UserPlus className="mr-1 h-4 w-4" /> Invite</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Invite Member</DialogTitle></DialogHeader>
                    <form onSubmit={handleInvite} className="space-y-4">
                      <div className="space-y-2"><Label>User ID (UUID)</Label><Input required value={inviteUserId} onChange={e => setInviteUserId(e.target.value)} placeholder="paste user UUID" /></div>
                      <div className="space-y-2"><Label>Role</Label><Input required value={inviteRole} onChange={e => setInviteRole(e.target.value)} placeholder="member" /></div>
                      <div className="space-y-2"><Label>Display Name (optional)</Label><Input value={inviteDisplayName} onChange={e => setInviteDisplayName(e.target.value)} /></div>
                      <Button type="submit" className="w-full" disabled={inviting}>{inviting ? "Adding…" : "Add Member"}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {members.map(m => (
                      <li key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span className="font-medium">{m.display_name || m.user_id.slice(0, 8) + "…"}</span>
                        <span className="rounded bg-accent px-2 py-0.5 text-xs text-accent-foreground">{m.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* Persons Tab */}
          {!isSubjectPerson && (
          <TabsContent value="persons">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Heart className="h-5 w-5 text-primary" /> Supported Persons
                </CardTitle>
                <Dialog open={personOpen} onOpenChange={setPersonOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">+ Add Person</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Supported Person</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreatePerson} className="space-y-4">
                      <div className="space-y-2"><Label>Label (name)</Label><Input required value={personLabel} onChange={e => setPersonLabel(e.target.value)} placeholder="e.g. Mom" /></div>
                      <div className="space-y-2"><Label>User ID (optional)</Label><Input value={personUserId} onChange={e => setPersonUserId(e.target.value)} placeholder="UUID if they have an account" /></div>
                      <Button type="submit" className="w-full" disabled={creatingPerson}>{creatingPerson ? "Creating…" : "Create Person"}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {persons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No supported persons yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {persons.map(p => (
                      <li
                        key={p.id}
                        onClick={() => setActivePersonId(p.id)}
                        className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                          activePersonId === p.id ? "border-primary bg-accent" : "hover:bg-muted"
                        }`}
                      >
                        <span className="font-medium">{p.label}</span>
                        {activePersonId === p.id && <span className="text-xs text-primary font-medium">Active</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* Agreements Tab */}
          <TabsContent value="agreements">
            {agreementView.type === "list" && (
              <AgreementsList
                groupId={groupId!}
                personId={activePersonId}
                onCreateNew={() => setAgreementView({ type: "create" })}
                onViewAgreement={(id) => setAgreementView({ type: "detail", agreementId: id })}
              />
            )}
            {agreementView.type === "create" && activePersonId && (
              <CreateAgreement
                groupId={groupId!}
                personId={activePersonId}
                onBack={() => setAgreementView({ type: "list" })}
                onCreated={() => setAgreementView({ type: "list" })}
              />
            )}
            {agreementView.type === "detail" && (
              <AgreementDetail
                agreementId={agreementView.agreementId}
                groupId={groupId!}
                onBack={() => setAgreementView({ type: "list" })}
              />
            )}
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            {timelineView.type === "list" && (
              <Timeline
                key={timelineKey}
                groupId={groupId!}
                personId={activePersonId}
                members={members}
                onAddNote={() => setTimelineView({ type: "add" })}
              />
            )}
            {timelineView.type === "add" && activePersonId && (
              <AddNote
                groupId={groupId!}
                personId={activePersonId}
                onBack={() => setTimelineView({ type: "list" })}
                onCreated={() => { setTimelineView({ type: "list" }); setTimelineKey(k => k + 1); }}
              />
            )}
          </TabsContent>

          {/* Contradictions Tab */}
          {!isSubjectPerson && (
            <TabsContent value="contradictions">
              {contradictionView.type === "list" && (
                <ContradictionsList
                  key={contradictionKey}
                  groupId={groupId!}
                  personId={activePersonId}
                  onCreateNew={() => setContradictionView({ type: "create" })}
                  onView={(id) => setContradictionView({ type: "detail", id })}
                />
              )}
              {contradictionView.type === "create" && activePersonId && (
                <CreateContradiction
                  groupId={groupId!}
                  personId={activePersonId}
                  onBack={() => setContradictionView({ type: "list" })}
                  onCreated={() => { setContradictionView({ type: "list" }); setContradictionKey(k => k + 1); }}
                />
              )}
              {contradictionView.type === "detail" && (
                <ContradictionDetail
                  contradictionId={contradictionView.id}
                  groupId={groupId!}
                  isCoordinator={isCoordinator}
                  onBack={() => setContradictionView({ type: "list" })}
                />
              )}
            </TabsContent>
          )}

          {/* Interventions Tab */}
          {!isSubjectPerson && (
          <TabsContent value="interventions">
            {interventionView.type === "list" && (
              <InterventionsList
                key={interventionKey}
                groupId={groupId!}
                personId={activePersonId}
                onCreateNew={() => setInterventionView({ type: "create" })}
                onView={(id) => setInterventionView({ type: "detail", id })}
              />
            )}
            {interventionView.type === "create" && activePersonId && (
              <CreateIntervention
                groupId={groupId!}
                personId={activePersonId}
                onBack={() => setInterventionView({ type: "list" })}
                onCreated={() => { setInterventionView({ type: "list" }); setInterventionKey(k => k + 1); }}
              />
            )}
            {interventionView.type === "detail" && (
              <InterventionDetail
                interventionId={interventionView.id}
                groupId={groupId!}
                isCoordinator={isCoordinator}
                onBack={() => setInterventionView({ type: "list" })}
              />
            )}
          </TabsContent>
          )}

          {/* Alerts Tab */}
          {!isSubjectPerson && (
            <TabsContent value="alerts">
              {alertView.type === "list" && (
                <AlertsList
                  key={alertKey}
                  groupId={groupId!}
                  personId={activePersonId}
                  isCoordinator={isCoordinator}
                  onView={(id) => setAlertView({ type: "detail", id })}
                />
              )}
              {alertView.type === "detail" && (
                <AlertDetail
                  alertId={alertView.id}
                  groupId={groupId!}
                  isCoordinator={isCoordinator}
                  onBack={() => { setAlertView({ type: "list" }); setAlertKey(k => k + 1); }}
                  onNavigateSource={(table, id) => {
                    if (table === "contradictions") {
                      setContradictionView({ type: "detail", id });
                    } else if (table === "interventions") {
                      setInterventionView({ type: "detail", id });
                    } else if (table === "agreement_acceptances") {
                      // Navigate to agreements tab — source_id is the acceptance, but we'd need agreement_id
                      // For now just go back to alerts
                    }
                  }}
                />
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
