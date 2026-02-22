import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { signOutAndReset } from "@/lib/signOut";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";

export default function AwaitingApproval() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading…</p></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Awaiting Approval</CardTitle>
          <CardDescription>
            Your access request has been received. A coordinator must approve you before access is granted.
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
