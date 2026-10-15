import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Contact, MessageCircle, Upload, CalendarDays, Send, Users, ScanLine, Radio, AlertTriangle } from "lucide-react";
import { PageHeader, SourceBadge, StatusBadge } from "@/components/Brand";
import { api, fmtDate, fmtPhone } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const KPIS = [
  ["total", "Total contacts", Contact],
  ["via_whatsapp", "Via WhatsApp", MessageCircle],
  ["via_panel", "Via panel", Upload],
  ["this_week", "Added this week", CalendarDays],
  ["notified", "Contacts notified", Send],
  ["team", "Team members", Users],
];

function Kpi({ k, label, Icon, value, i }) {
  return (
    <div className="rise rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-colors duration-300 hover:border-emerald-500/40" style={{ animationDelay: `${i * 60}ms` }} data-testid={`kpi-${k}`}>
      <div className="flex items-center justify-between text-slate-400"><span className="text-xs font-medium uppercase tracking-wider">{label}</span><Icon className="h-4 w-4" /></div>
      <div className="mt-4 font-display text-4xl font-extrabold">{value ?? "—"}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => {
    api.get("/dashboard").then((r) => setD(r.data));
  }, []);

  return (
    <div data-testid="dashboard-page">
      <PageHeader label={user.org?.name} title={`Hello, ${user.name.split(" ")[0]}`}>
        <Link to="/app/scan" data-testid="quick-scan-button" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"><ScanLine className="h-4 w-4" />Upload cards</Link>
        <Link to="/app/simulator" data-testid="quick-simulator-button" className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-5 py-2.5 text-sm hover:border-emerald-500/60"><Radio className="h-4 w-4" />Test WhatsApp</Link>
      </PageHeader>

      {d && !d.wa_configured && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200" data-testid="wa-simulation-banner">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          WhatsApp is in SIMULATION mode — messages are logged but not delivered until Meta Cloud API keys are added.
        </div>
      )}
      {!user.mobile && (
        <div className="mb-8 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm text-sky-200" data-testid="no-mobile-banner">
          Add your WhatsApp number in <Link to="/app/settings" className="underline">Settings</Link> so the system can recognise cards you send.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {KPIS.map(([k, label, Icon], i) => <Kpi key={k} k={k} label={label} Icon={Icon} value={d?.[k]} i={i} />)}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">Recent contacts</h3><Link to="/app/contacts" className="text-xs text-emerald-400 hover:underline" data-testid="dashboard-view-contacts">View all</Link></div>
          {d?.recent_contacts?.length ? (
            <ul className="divide-y divide-slate-800">
              {d.recent_contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-3" data-testid={`recent-contact-${c.id}`}>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.contact_person || "—"} <span className="text-slate-500">· {c.designation}</span></div>
                    <div className="truncate text-xs text-slate-400">{c.company_name} · {fmtPhone(c.mobile)} · by {c.added_by_name}</div>
                  </div>
                  <SourceBadge source={c.source} />
                </li>
              ))}
            </ul>
          ) : <p className="py-10 text-center text-sm text-slate-500">No contacts yet. Upload a card or send one on WhatsApp.</p>}
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">WhatsApp activity</h3><Link to="/app/messages" className="text-xs text-emerald-400 hover:underline">Logs</Link></div>
          {d?.recent_messages?.length ? (
            <ul className="space-y-3">
              {d.recent_messages.map((m) => (
                <li key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center justify-between text-xs text-slate-500"><span>{m.direction === "inbound" ? "From" : "To"} {fmtPhone(m.phone)}</span><StatusBadge status={m.status} /></div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-300">{m.body}</p>
                </li>
              ))}
            </ul>
          ) : <p className="py-10 text-center text-sm text-slate-500">No messages yet.</p>}
        </section>
      </div>
      <p className="mt-6 text-xs text-slate-600">{d ? `Updated ${fmtDate(new Date().toISOString())}` : ""}</p>
    </div>
  );
}
