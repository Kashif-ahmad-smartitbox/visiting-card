import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/AuthLayout";
import { GoogleButton } from "@/components/Brand";
import { Field, ORG_FIELDS } from "@/components/OrgFields";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg, startGoogleLogin } from "@/lib/api";

const USER_FIELDS = [
  { key: "name", label: "Your full name", testid: "register-name-input", required: true },
  { key: "email", label: "Email", type: "email", testid: "register-email-input", required: true },
  { key: "password", label: "Password", type: "password", testid: "register-password-input", required: true },
];

export default function Register() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ org_name: "", gstin: "", mobile: "", address: "", name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={user.org_id ? "/app" : "/onboarding"} replace />;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/register", form);
      setUser(data);
      toast.success("Organisation registered", { description: `WhatsApp confirmation sent to +${data.mobile}` });
      navigate("/app");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout label="Onboarding" title="Register your organisation" sub="You'll be the admin. Add your team after registering.">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" data-testid="register-form">
        {ORG_FIELDS.map((f) => <Field key={f.key} f={f} value={form[f.key]} onChange={set} />)}
        <div className="sm:col-span-2 mt-2 border-t border-slate-800 pt-4 font-mono text-[11px] uppercase tracking-widest text-slate-500">Admin login</div>
        {USER_FIELDS.map((f) => <Field key={f.key} f={f} value={form[f.key]} onChange={set} />)}
        <Button type="submit" disabled={busy} data-testid="org-register-button" className="sm:col-span-2 mt-2 h-11 bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-400">
          {busy ? "Registering..." : "Register & notify on WhatsApp"}
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-slate-500"><div className="h-px flex-1 bg-slate-800" />OR<div className="h-px flex-1 bg-slate-800" /></div>
      <GoogleButton onClick={startGoogleLogin} testid="register-google-button" />
      <p className="mt-8 text-sm text-slate-400">
        Already registered? <Link to="/login" className="text-emerald-400 hover:underline" data-testid="register-login-link">Log in</Link>
      </p>
    </AuthLayout>
  );
}
