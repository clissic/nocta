import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { AdminLayout } from "./components/admin/AdminLayout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { VenuesPage } from "./pages/VenuesPage";
import { VenueDetailPage } from "./pages/VenueDetailPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { LikesPage } from "./pages/LikesPage";
import { MatchesPage } from "./pages/MatchesPage";
import { ChatPage } from "./pages/ChatPage";
import { ProfilePage } from "./pages/ProfilePage";
import { VenueRequestPage } from "./pages/VenueRequestPage";
import { VenueManagePage } from "./pages/VenueManagePage";
import { MyPromosPage } from "./pages/MyPromosPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminRequestsPage } from "./pages/admin/AdminRequestsPage";
import { AdminVenuesPage } from "./pages/admin/AdminVenuesPage";
import { AdminVenueCreatePage } from "./pages/admin/AdminVenueCreatePage";
import { AdminContentPage } from "./pages/admin/AdminContentPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminReportsPage } from "./pages/admin/AdminReportsPage";
import { AdminVenueRequestPage } from "./pages/AdminVenueRequestPage";
import { NoctaLoading } from "./components/NoctaLoading";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="app-shell">
        <div className="app-frame">
          <NoctaLoading />
        </div>
      </div>
    );
  }
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return children;
}

function RequireVerified({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && !user.emailVerified && user.role === "user") {
    return <Navigate to="/verify-email" replace />;
  }
  return children;
}

function RequireProfile({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && !user.profileComplete && user.role === "user") {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== "admin") return <Navigate to="/venues" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route
        path="/onboarding"
        element={
          <Protected>
            <RequireVerified>
              <OnboardingPage />
            </RequireVerified>
          </Protected>
        }
      />

      <Route
        element={
          <Protected>
            <RequireVerified>
              <RequireProfile>
                <AppLayout />
              </RequireProfile>
            </RequireVerified>
          </Protected>
        }
      >
        <Route
          index
          element={
            <AdminHomeRedirect>
              <Navigate to="/venues" replace />
            </AdminHomeRedirect>
          }
        />
        <Route path="venues" element={<VenuesPage />} />
        <Route path="venues/:id/manage" element={<VenueManagePage />} />
        <Route path="venues/:id" element={<VenueDetailPage />} />
        <Route path="likes" element={<LikesPage />} />
        <Route path="muro" element={<Navigate to="/venues" replace />} />
        <Route path="discover" element={<DiscoverPage />} />
        <Route path="matches" element={<MatchesPage />} />
        <Route path="matches/:id" element={<ChatPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/promos" element={<MyPromosPage />} />
        <Route path="profile/venue-request" element={<VenueRequestPage />} />
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminOverviewPage />} />
          <Route path="requests" element={<AdminRequestsPage />} />
          <Route path="venues" element={<AdminVenuesPage />} />
          <Route path="venues/new" element={<AdminVenueCreatePage />} />
          <Route path="content" element={<AdminContentPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="venue-requests/:id" element={<AdminVenueRequestPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/venues" replace />} />
    </Routes>
  );
}

function AdminHomeRedirect({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === "admin") return <Navigate to="/admin/overview" replace />;
  return children;
}
