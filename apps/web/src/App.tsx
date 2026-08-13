import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { VenuesPage } from "./pages/VenuesPage";
import { VenueDetailPage } from "./pages/VenueDetailPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { MatchesPage } from "./pages/MatchesPage";
import { ChatPage } from "./pages/ChatPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminPage } from "./pages/AdminPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-shell"><div className="app-frame"><div className="app-screen text-secondary">Cargando…</div></div></div>;
  if (!user) return <Navigate to="/login" replace />;
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
  if (!user || user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route
        path="/onboarding"
        element={
          <Protected>
            <OnboardingPage />
          </Protected>
        }
      />

      <Route
        element={
          <Protected>
            <RequireProfile>
              <AppLayout />
            </RequireProfile>
          </Protected>
        }
      >
        <Route
          index
          element={
            <AdminHomeRedirect>
              <VenuesPage />
            </AdminHomeRedirect>
          }
        />
        <Route path="venues/:id" element={<VenueDetailPage />} />
        <Route path="discover" element={<DiscoverPage />} />
        <Route path="matches" element={<MatchesPage />} />
        <Route path="matches/:id" element={<ChatPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AdminHomeRedirect({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  return children;
}
