import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/AuthLayout";
import { Field, ORG_FIELDS } from "@/components/OrgFields";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";

export default function Onboarding() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ org_name: "", gstin: "", mobile: "", address: "" });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/onboard", form);
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
    <AuthLayout label="One last step" title={`Welcome, ${user.name}`} sub="Tell us about your organisation to finish setting up.">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" data-testid="onboarding-form">
        {ORG_FIELDS.map((f) => <Field key={f.key} f={f} value={form[f.key]} onChange={set} />)}
        <Button type="submit" disabled={busy} data-testid="onboarding-submit-button" className="sm:col-span-2 mt-2 h-11 bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-400">
          {busy ? "Saving..." : "Complete registration"}
        </Button>
      </form>
      <button onClick={logout} data-testid="onboarding-logout" className="mt-6 text-sm text-slate-500 hover:text-slate-300">Use a different account</button>
    </AuthLayout>
  );
}
