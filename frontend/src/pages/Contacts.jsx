import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, SourceBadge } from "@/components/Brand";
import ContactDrawer from "@/components/ContactDrawer";
import { API, api, fmtDate, fmtPhone } from "@/lib/api";

export default function Contacts() {
  const [rows, setRows] = useState([]);
  const [team, setTeam] = useState([]);
  const [q, setQ] = useState("");
  const [source, setSource] = useState("all");
  const [addedBy, setAddedBy] = useState("all");
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  useEffect(() => {
    api.get("/team").then((r) => setTeam(r.data));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.get("/contacts", { params: { q, source, added_by: addedBy } }).then((r) => { setRows(r.data); setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [q, source, addedBy]);

  const onChanged = (updated, deletedId) => {
    if (deletedId) { setRows((r) => r.filter((x) => x.id !== deletedId)); setActive(null); return; }
    setRows((r) => r.map((x) => (x.id === updated.id ? updated : x)));
    setActive(updated);
  };

  return (
    <div data-testid="contacts-page">
      <PageHeader label="Directory" title="Contacts">
        <a href={`${API}/contacts/export.csv`} data-testid="contacts-export-button" className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-5 py-2.5 text-sm hover:border-emerald-500/60"><Download className="h-4 w-4" />Export CSV</a>
      </PageHeader>
      <div className="mb-6 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, person, designation, city, email..." className="h-11 bg-slate-900 pl-10" data-testid="contacts-search-input" />
        </div>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="h-11 w-full bg-slate-900 md:w-44" data-testid="contact-filter-source"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="panel">Panel</SelectItem>
          </SelectContent>
        </Select>
        <Select value={addedBy} onValueChange={setAddedBy}>
          <SelectTrigger className="h-11 w-full bg-slate-900 md:w-52" data-testid="contact-filter-added-by"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Added by anyone</SelectItem>
            {team.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/30">
        <table className="w-full min-w-[900px] text-sm" data-testid="contacts-table">
          <thead className="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>{["Contact", "Company", "Mobile", "Email", "Added by", "Source", "Date"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((c) => (
              <tr key={c.id} onClick={() => setActive(c)} data-testid={`contact-row-${c.id}`} className="cursor-pointer transition-colors hover:bg-slate-800/40">
                <td className="px-4 py-3"><div className="font-medium">{c.contact_person || "—"}</div><div className="text-xs text-slate-500">{c.designation}</div></td>
                <td className="px-4 py-3"><div>{c.company_name || "—"}</div><div className="max-w-[240px] truncate text-xs text-slate-500">{c.address}</div></td>
                <td className="px-4 py-3 font-mono text-xs">{fmtPhone(c.mobile)}</td>
                <td className="px-4 py-3 text-slate-400">{c.email || "—"}</td>
                <td className="px-4 py-3">{c.added_by_name}</td>
                <td className="px-4 py-3"><SourceBadge source={c.source} /></td>
                <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !rows.length && <p className="py-16 text-center text-sm text-slate-500" data-testid="contacts-empty">No contacts found.</p>}
      </div>
      <ContactDrawer contact={active} onClose={() => setActive(null)} onChanged={onChanged} />
    </div>
  );
}
