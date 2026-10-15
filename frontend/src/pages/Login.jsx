import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/AuthLayout";
import { GoogleButton } from "@/components/Brand";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg, startGoogleLogin } from "@/lib/api";

export default function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={user.org_id ? "/app" : "/onboarding"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/login", form);
      setUser(data);
      navigate("/app");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout label="Welcome back" title="Log in to your panel" sub="Access your organisation's contacts from anywhere.">
      <form onSubmit={submit} className="space-y-5" data-testid="login-form">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required data-testid="login-email-input" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 bg-slate-900" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required data-testid="login-password-input" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-11 bg-slate-900" />
        </div>
        <Button type="submit" disabled={busy} data-testid="login-submit-button" className="h-11 w-full bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-400">
          {busy ? "Signing in..." : "Log in"}
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-slate-500"><div className="h-px flex-1 bg-slate-800" />OR<div className="h-px flex-1 bg-slate-800" /></div>
      <GoogleButton onClick={startGoogleLogin} testid="login-google-button" />
      <p className="mt-8 text-sm text-slate-400">
        New organisation? <Link to="/register" className="text-emerald-400 hover:underline" data-testid="login-register-link">Register here</Link>
      </p>
    </AuthLayout>
  );
}
