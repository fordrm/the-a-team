import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import UpdatePassword from "./pages/UpdatePassword";
import CreateGroup from "./pages/CreateGroup";
import GroupDashboard from "./pages/GroupDashboard";
import RequestAccess from "./pages/RequestAccess";
import PersonPortal from "./pages/PersonPortal";
import AwaitingApproval from "./pages/AwaitingApproval";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedGroupRoute({ children }: { children: React.ReactNode }) {
  const { groupId } = useParams<{ groupId: string }>();
  return (
    <ProtectedRoute require="member" groupId={groupId}>
      {children}
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/update-password" element={<UpdatePassword />} />

            {/* Authenticated routes */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/awaiting-approval" element={<ProtectedRoute><AwaitingApproval /></ProtectedRoute>} />

            {/* Must NOT be a supported person */}
            <Route path="/create-group" element={<ProtectedRoute require="not-supported-person"><CreateGroup /></ProtectedRoute>} />

            {/* Must be a member of the specific group */}
            <Route path="/group/:groupId" element={<ProtectedGroupRoute><GroupDashboard /></ProtectedGroupRoute>} />
            <Route path="/group/:groupId/request-access" element={<ProtectedRoute><RequestAccess /></ProtectedRoute>} />

            {/* Supported person portal */}
            <Route path="/person-portal" element={<ProtectedRoute><PersonPortal /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
