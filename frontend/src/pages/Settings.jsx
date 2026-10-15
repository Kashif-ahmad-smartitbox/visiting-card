import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/Brand";
import { useAuth } from "@/context/AuthContext";
import { BACKEND_URL, api, errMsg } from "@/lib/api";

const ORG = [["name", "Organisation name"], ["gstin", "GSTIN"], ["mobile", "Company phone"], ["email", "Company email"], ["website", "Website"], ["address", "Address", true]];
const ME = [["name", "Your name"], ["mobile", "Your WhatsApp mobile"], ["designation", "Designation"]];
const plus = (v) => (v ? `+${v}` : "");

function Form({ title, fields, initial, onSave, disabled, prefix }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await onSave(f); toast.success("Saved"); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 lg:p-8">
      <h3 className="mb-6 text-lg font-bold">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([k, label, area]) => {
          const C = area ? Textarea : Input;
          return (
            <div key={k} className={`space-y-1.5 ${area ? "sm:col-span-2" : ""}`}>
              <Label className="text-xs text-slate-400">{label}</Label>
              <C value={f[k] || ""} disabled={disabled} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="bg-slate-950" data-testid={`${prefix}-${k}-input`} />
            </div>
          );
        })}
      </div>
      {!disabled && <Button type="submit" disabled={busy} className="mt-6 bg-emerald-500 text-slate-950 hover:bg-emerald-400" data-testid={`${prefix}-save-button`}>{busy ? "Saving..." : "Save changes"}</Button>}
    </form>
  );
}

function WaPanel() {
  const [s, setS] = useState(null);
  useEffect(() => {
    api.get("/wa/status").then((r) => setS(r.data));
  }, []);
  if (!s) return null;
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 lg:p-8" data-testid="wa-config-panel">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-bold">WhatsApp Cloud API</h3>
        {s.configured ? <span className="flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="h-4 w-4" />Connected ({s.phone_number_id})</span>
          : <span className="flex items-center gap-1 text-xs text-amber-300" data-testid="wa-status-simulated"><AlertTriangle className="h-4 w-4" />SIMULATION mode</span>}
      </div>
      <p className="mt-2 text-sm text-slate-400">One platform WhatsApp number serves all organisations. Senders are recognised by their registered mobile.</p>
      <div className="mt-6 grid gap-4">
        <div className="space-y-1.5"><Label className="text-xs text-slate-400">Webhook callback URL</Label><Input readOnly value={`${BACKEND_URL}${s.webhook_path}`} className="bg-slate-950 font-mono text-xs" data-testid="wa-webhook-url" /></div>
        {s.verify_token && <div className="space-y-1.5"><Label className="text-xs text-slate-400">Verify token (platform owner only)</Label><Input readOnly value={s.verify_token} className="bg-slate-950 font-mono text-xs" data-testid="wa-api-key-input" /></div>}
      </div>
      {s.verify_token && !s.configured && (
        <ol className="mt-6 list-decimal space-y-1 pl-5 text-sm text-slate-400">
          <li>In Meta for Developers → WhatsApp → API Setup, copy the Phone Number ID and create a permanent system-user token.</li>
          <li>Share Phone Number ID, Access Token and App Secret with your developer to add as server secrets.</li>
          <li>In Webhooks, use the callback URL & verify token above and subscribe to <span className="font-mono">messages</span>.</li>
        </ol>
      )}
    </section>
  );
}

export default function Settings() {
  const { user, setUser } = useAuth();
  const isAdmin = user.role === "admin";
  return (
    <div data-testid="settings-page" className="space-y-6">
      <PageHeader label="Configuration" title="Settings" />
      <Form title="My profile" prefix="profile" fields={ME} initial={{ ...user, mobile: plus(user.mobile) }}
        onSave={async (f) => { const { data } = await api.put("/profile", { name: f.name, mobile: f.mobile, designation: f.designation }); setUser(data); }} />
      <Form title={isAdmin ? "Organisation profile" : "Organisation profile (admin only)"} prefix="org" fields={ORG} disabled={!isAdmin}
        initial={{ ...user.org, mobile: plus(user.org?.mobile) }}
        onSave={async (f) => { const { data } = await api.put("/org", Object.fromEntries(ORG.map(([k]) => [k, f[k] || ""]))); setUser({ ...user, org: data }); }} />
      <WaPanel />
    </div>
  );
}
