import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/Brand";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg, fmtPhone } from "@/lib/api";

const EMPTY = { name: "", email: "", mobile: "", designation: "", role: "member", password: "" };
const INPUTS = [
  ["name", "Full name", "text"], ["email", "Email", "email"], ["mobile", "WhatsApp mobile", "text"],
  ["designation", "Designation", "text"], ["password", "Panel password (optional — or they use Google)", "password"],
];

function AddMember({ open, setOpen, onAdded }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/team", { ...form, password: form.password || null });
      toast.success(`${data.name} added`, { description: "Welcome message sent on WhatsApp" });
      onAdded(data);
      setForm(EMPTY);
      setOpen(false);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-slate-800 bg-[#0d1220]" data-testid="add-member-dialog">
        <DialogHeader><DialogTitle>Add team member</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {INPUTS.map(([k, label, type]) => (
            <div key={k} className="space-y-1.5">
              <Label>{label}</Label>
              <Input type={type} required={["name", "email", "mobile"].includes(k)} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="bg-slate-900" data-testid={`member-${k}-input`} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger className="bg-slate-900" data-testid="member-role-select"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400" data-testid="member-submit-button">{busy ? "Adding..." : "Add & notify on WhatsApp"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Team() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    api.get("/team").then((r) => setRows(r.data));
  }, []);

  const update = async (m, patch) => {
    try {
      const { data } = await api.patch(`/team/${m.user_id}`, patch);
      setRows((r) => r.map((x) => (x.user_id === m.user_id ? { ...data, contacts_added: x.contacts_added } : x)));
      toast.success("Member updated");
    } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async (m) => {
    if (!window.confirm(`Remove ${m.name}?`)) return;
    try {
      await api.delete(`/team/${m.user_id}`);
      setRows((r) => r.filter((x) => x.user_id !== m.user_id));
      toast.success("Member removed");
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div data-testid="team-page">
      <PageHeader label="Access control" title="Team">
        {isAdmin && <Button onClick={() => setOpen(true)} data-testid="add-team-member-button" className="rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400"><Plus className="mr-1 h-4 w-4" />Add member</Button>}
      </PageHeader>
      <p className="mb-6 max-w-2xl text-sm text-slate-400">Each member's WhatsApp number is how the system recognises who sent a card. Cards they send are saved to this organisation with their name as "added by".</p>
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/30">
        <table className="w-full min-w-[760px] text-sm" data-testid="team-table">
          <thead className="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>{["Member", "WhatsApp", "Role", "Cards added", "Active", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((m) => (
              <tr key={m.user_id} data-testid={`team-row-${m.user_id}`}>
                <td className="px-4 py-3"><div className="font-medium">{m.name} {m.user_id === user.user_id && <span className="text-xs text-emerald-400">(you)</span>}</div><div className="text-xs text-slate-500">{m.email}{m.designation ? ` · ${m.designation}` : ""}</div></td>
                <td className="px-4 py-3 font-mono text-xs">{fmtPhone(m.mobile)}</td>
                <td className="px-4 py-3">
                  {isAdmin && m.user_id !== user.user_id ? (
                    <Select value={m.role} onValueChange={(v) => update(m, { role: v })}>
                      <SelectTrigger className="h-8 w-28 bg-slate-900" data-testid={`team-role-${m.user_id}`}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                    </Select>
                  ) : <span className="capitalize">{m.role}</span>}
                </td>
                <td className="px-4 py-3 font-display text-lg font-bold">{m.contacts_added}</td>
                <td className="px-4 py-3"><Switch checked={m.active !== false} disabled={!isAdmin || m.user_id === user.user_id} onCheckedChange={(v) => update(m, { active: v })} data-testid={`team-active-${m.user_id}`} /></td>
                <td className="px-4 py-3 text-right">{isAdmin && m.user_id !== user.user_id && <button onClick={() => remove(m)} data-testid={`team-remove-${m.user_id}`} className="text-slate-500 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AddMember open={open} setOpen={setOpen} onAdded={(m) => setRows((r) => [...r, m])} />
    </div>
  );
}
