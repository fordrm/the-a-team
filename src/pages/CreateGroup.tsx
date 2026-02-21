import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function CreateGroup() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      // Insert group
      const { data: group, error: groupErr } = await supabase
        .from("groups")
        .insert({ name, created_by_user_id: user.id })
        .select()
        .single();
      if (groupErr) throw groupErr;

      // Insert creator membership
      const { error: memErr } = await supabase
        .from("group_memberships")
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: "coordinator",
          is_active: true,
          capabilities: {},
        });
      if (memErr) throw memErr;

      navigate(`/group/${group.id}`);
    } catch (err: any) {
      toast({ title: "Error creating group", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create a Group</CardTitle>
          <CardDescription>Name your care coordination group</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input id="group-name" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Smith Family Care Team" />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating…" : "Create Group"}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <button type="button" onClick={signOut} className="text-sm text-muted-foreground hover:underline">Sign Out</button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
