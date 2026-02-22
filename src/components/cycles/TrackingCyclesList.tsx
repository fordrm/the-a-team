import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarRange, Plus, Pencil, Archive, CheckCircle, X } from "lucide-react";

interface TrackingCyclesListProps {
  groupId: string;
  personId: string | null;
  personLabel?: string;
  isCoordinator: boolean;
}

interface CycleRow {
  id: string;
  label: string;
  reason: string | null;
  start_date: string;
  expected_end: string | null;
  actual_end: string | null;
  status: string;
  baseline: any;
  closure: any;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
  archived: "bg-gray-50 text-gray-400",
};

export default function TrackingCyclesList({ groupId, personId, personLabel, isCoordinator }: TrackingCyclesListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cycles, setCycles] = useState<CycleRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [formLabel, setFormLabel] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formStatus, setFormStatus] = useState<"planning" | "active">("active");
  const [submitting, setSubmitting] = useState(false);

  // Edit form
  const [editCycle, setEditCycle] = useState<CycleRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  // Close form
  const [closeCycle, setCloseCycle] = useState<CycleRow | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReflection, setCloseReflection] = useState("");

  const fetchCycles = async () => {
    if (!personId) { setCycles([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("tracking_cycles")
      .select("*")
      .eq("group_id", groupId)
      .eq("person_id", personId)
      .order("start_date", { ascending: false });
    if (error) {
      toast({ title: "Error loading cycles", description: error.message, variant: "destructive" });
    }
    setCycles(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCycles(); }, [groupId, personId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !personId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("tracking_cycles").insert({
        group_id: groupId,
        person_id: personId,
        label: formLabel.trim(),
        reason: formReason.trim() || null,
        start_date: formStart,
        expected_end: formEnd || null,
        status: formStatus,
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: "Cycle created", description: `"${formLabel.trim()}" has been created.` });
      setCreateOpen(false);
      setFormLabel("");
      setFormReason("");
      setFormStart("");
      setFormEnd("");
      setFormStatus("active");
      fetchCycles();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCycle) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("tracking_cycles").update({
        label: editLabel.trim(),
        reason: editReason.trim() || null,
        start_date: editStart,
        expected_end: editEnd || null,
      }).eq("id", editCycle.id);
      if (error) throw error;
      toast({ title: "Cycle updated" });
      setEditOpen(false);
      setEditCycle(null);
      fetchCycles();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (cycleId: string) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("tracking_cycles")
        .update({ status: "active" })
        .eq("id", cycleId);
      if (error) throw error;
      toast({ title: "Cycle activated" });
      fetchCycles();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeCycle) return;
    setSubmitting(true);
    try {
      const closureData = {
        reflection: closeReflection.trim() || null,
        closed_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("tracking_cycles").update({
        status: "closed",
        actual_end: new Date().toISOString().split("T")[0],
        closure: closureData,
      }).eq("id", closeCycle.id);
      if (error) throw error;
      toast({ title: "Cycle closed", description: `"${closeCycle.label}" has been closed.` });
      setCloseOpen(false);
      setCloseCycle(null);
      setCloseReflection("");
      fetchCycles();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (cycleId: string) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("tracking_cycles")
        .update({ status: "archived" })
        .eq("id", cycleId);
      if (error) throw error;
      toast({ title: "Cycle archived" });
      fetchCycles();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (c: CycleRow) => {
    setEditCycle(c);
    setEditLabel(c.label);
    setEditReason(c.reason || "");
    setEditStart(c.start_date);
    setEditEnd(c.expected_end || "");
    setEditOpen(true);
  };

  const openClose = (c: CycleRow) => {
    setCloseCycle(c);
    setCloseReflection("");
    setCloseOpen(true);
  };

  const formatDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (!personId) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">Select a supported person to view tracking cycles.</p>
        </CardContent>
      </Card>
    );
  }

  const activeCycles = cycles.filter(c => c.status === "active" || c.status === "planning");
  const closedCycles = cycles.filter(c => c.status === "closed" || c.status === "archived");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarRange className="h-5 w-5 text-primary" />
            Tracking Cycles
            {personLabel && <span className="text-sm font-normal text-muted-foreground">for {personLabel}</span>}
          </CardTitle>
          {isCoordinator && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1 h-4 w-4" /> New Cycle
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Tracking Cycle</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input required value={formLabel} onChange={e => setFormLabel(e.target.value)} placeholder='e.g. "Spring 2026"' />
                  </div>
                  <div className="space-y-2">
                    <Label>Reason (optional)</Label>
                    <Textarea value={formReason} onChange={e => setFormReason(e.target.value)} placeholder="e.g. Seasonal psychosis risk — historically peaks March–May" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input required type="date" value={formStart} onChange={e => setFormStart(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Expected End (optional)</Label>
                      <Input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Start as</Label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1.5 text-sm">
                        <input type="radio" name="cycleStatus" checked={formStatus === "active"} onChange={() => setFormStatus("active")} />
                        Active now
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <input type="radio" name="cycleStatus" checked={formStatus === "planning"} onChange={() => setFormStatus("planning")} />
                        Planning (activate later)
                      </label>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Creating…" : "Create Cycle"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : cycles.length === 0 ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-sm font-medium">No tracking cycles yet</p>
              <p className="text-sm text-muted-foreground">
                Cycles help you organize tracking into focused periods — like seasonal risk windows — so you can compare them later.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeCycles.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Active & Planned</h3>
                  <ul className="space-y-2">
                    {activeCycles.map(c => (
                      <li key={c.id} className="rounded-md border px-3 py-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{c.label}</span>
                            <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[c.status]}`}>
                              {c.status}
                            </Badge>
                          </div>
                          {isCoordinator && (
                            <div className="flex items-center gap-1">
                              {c.status === "planning" && (
                                <Button variant="ghost" size="sm" onClick={() => handleActivate(c.id)} disabled={submitting} title="Activate">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => openEdit(c)} disabled={submitting} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {c.status === "active" && (
                                <Button variant="ghost" size="sm" onClick={() => openClose(c)} disabled={submitting} title="Close cycle">
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(c.start_date)}
                          {c.expected_end ? ` — ${formatDate(c.expected_end)}` : " — open-ended"}
                        </p>
                        {c.reason && (
                          <p className="text-xs text-muted-foreground italic">{c.reason}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {closedCycles.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Closed</h3>
                  <ul className="space-y-2">
                    {closedCycles.map(c => (
                      <li key={c.id} className="rounded-md border px-3 py-3 space-y-1.5 opacity-75">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{c.label}</span>
                            <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[c.status]}`}>
                              {c.status}
                            </Badge>
                          </div>
                          {isCoordinator && c.status === "closed" && (
                            <Button variant="ghost" size="sm" onClick={() => handleArchive(c.id)} disabled={submitting} title="Archive">
                              <Archive className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(c.start_date)}
                          {c.actual_end ? ` — ${formatDate(c.actual_end)}` : c.expected_end ? ` — ${formatDate(c.expected_end)}` : ""}
                        </p>
                        {c.closure?.reflection && (
                          <p className="text-xs text-muted-foreground italic border-l-2 pl-2 mt-1">{c.closure.reflection}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Cycle</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input required value={editLabel} onChange={e => setEditLabel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea value={editReason} onChange={e => setEditReason(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input required type="date" value={editStart} onChange={e => setEditStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expected End</Label>
                <Input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save Changes"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close Cycle Dialog */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Close Cycle: {closeCycle?.label}</DialogTitle></DialogHeader>
          <form onSubmit={handleClose} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Closing this cycle marks it as complete. You can add a reflection below to capture what you learned.
            </p>
            <div className="space-y-2">
              <Label>Reflection (optional but recommended)</Label>
              <Textarea
                value={closeReflection}
                onChange={e => setCloseReflection(e.target.value)}
                placeholder="What worked this cycle? What would you change next time? Any early warning signs to watch for?"
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setCloseOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={submitting}>
                {submitting ? "Closing…" : "Close Cycle"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
