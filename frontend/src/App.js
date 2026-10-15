import "@/App.css";
import { useEffect, useRef } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Onboarding from "@/pages/Onboarding";
import AppShell from "@/components/AppShell";
import Dashboard from "@/pages/Dashboard";
import Scan from "@/pages/Scan";
import Contacts from "@/pages/Contacts";
import Team from "@/pages/Team";
import Simulator from "@/pages/Simulator";
import Messages from "@/pages/Messages";
import Settings from "@/pages/Settings";

export const Loader = () => (
  <div className="min-h-screen grid place-items-center" data-testid="page-loader">
    <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
  </div>
);

function AuthCallback() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const sid = new URLSearchParams(location.hash.slice(1)).get("session_id");
    api
      .post("/auth/google/session", { session_id: sid })
      .then(({ data }) => {
        setUser(data);
        window.history.replaceState(null, "", window.location.pathname);
        navigate(data.org_id ? "/app" : "/onboarding", { replace: true });
      })
      .catch(() => {
        toast.error("Google sign-in failed");
        setUser(false);
        navigate("/login", { replace: true });
      });
  }, [location.hash, navigate, setUser]);
  return <Loader />;
}

function Protected({ children, needOrg = true }) {
  const { user } = useAuth();
  if (user === null) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (needOrg && !user.org_id) return <Navigate to="/onboarding" replace />;
  if (!needOrg && user.org_id) return <Navigate to="/app" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/onboarding" element={<Protected needOrg={false}><Onboarding /></Protected>} />
      <Route path="/app" element={<Protected><AppShell /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="scan" element={<Scan />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="team" element={<Team />} />
        <Route path="simulator" element={<Simulator />} />
        <Route path="messages" element={<Messages />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App dark">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster theme="dark" position="bottom-right" duration={3500} richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
