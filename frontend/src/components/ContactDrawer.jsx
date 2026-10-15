import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Send, Trash2, Save, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/Brand";
import { API, api, errMsg, fmtDate } from "@/lib/api";

const FIELDS = [
  ["company_name", "Company name"], ["contact_person", "Contact person"], ["designation", "Designation"],
  ["mobile", "Mobile"], ["email", "Email"], ["other_phones", "Other phones"], ["website", "Website"], ["address", "Address", true],
];

export default function ContactDrawer({ contact, onClose, onChanged }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (contact) setForm({ ...contact, mobile: contact.mobile ? `+${contact.mobile}` : "" });
  }, [contact]);
  if (!contact) return null;

  const save = async () => {
    setBusy(true);
    try {
      const body = Object.fromEntries(FIELDS.map(([k]) => [k, form[k] || ""]));
      const { data } = await api.put(`/contacts/${contact.id}`, body);
      toast.success("Contact updated");
      onChanged(data);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const notify = async () => {
    try {
      const { data } = await api.post(`/contacts/${contact.id}/notify`);
      toast.success(data.simulated ? "Notification logged (SIMULATED)" : "WhatsApp notification sent");
    } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async () => {
    if (!window.confirm("Delete this contact?")) return;
    try {
      await api.delete(`/contacts/${contact.id}`);
      toast.success("Contact deleted");
      onChanged(null, contact.id);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const cardUrl = `${API}/contacts/${contact.id}/card`;
  return (
    <Sheet open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-slate-800 bg-[#0d1220] sm:max-w-xl" data-testid="contact-drawer">
        <SheetHeader>
          <SheetTitle className="text-2xl font-extrabold">{contact.contact_person || contact.company_name || "Contact"}</SheetTitle>
          <div className="flex items-center gap-2 text-xs text-slate-400"><SourceBadge source={contact.source} /> Added by {contact.added_by_name} · {fmtDate(contact.created_at)}</div>
        </SheetHeader>
        {contact.card_file && (
          contact.card_mime === "application/pdf" ? (
            <a href={cardUrl} target="_blank" rel="noreferrer" className="mt-6 flex items-center gap-2 rounded-lg border border-slate-800 p-4 text-sm text-emerald-300" data-testid="contact-card-pdf"><FileText className="h-4 w-4" />Open original card (PDF)</a>
          ) : (
            <img src={cardUrl} alt="Visiting card" className="mt-6 max-h-64 w-full rounded-lg border border-slate-800 object-contain bg-slate-950" data-testid="contact-card-image" />
          )
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([k, label, area]) => {
            const C = area ? Textarea : Input;
            return (
              <div key={k} className={`space-y-1.5 ${area ? "sm:col-span-2" : ""}`}>
                <Label className="text-xs text-slate-400">{label}</Label>
                <C value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="bg-slate-900" data-testid={`contact-edit-${k}`} />
              </div>
            );
          })}
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          <Button onClick={save} disabled={busy} data-testid="contact-save-button" className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"><Save className="mr-2 h-4 w-4" />Save</Button>
          <Button variant="outline" asChild className="border-slate-700"><a href={`${API}/contacts/${contact.id}/vcard`} data-testid="contact-vcard-button"><Download className="mr-2 h-4 w-4" />vCard</a></Button>
          <Button variant="outline" onClick={notify} disabled={!contact.mobile} data-testid="contact-notify-button" className="border-slate-700"><Send className="mr-2 h-4 w-4" />Re-send WhatsApp</Button>
          <Button variant="outline" onClick={remove} data-testid="contact-delete-button" className="border-red-500/40 text-red-300 hover:bg-red-500/10"><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
