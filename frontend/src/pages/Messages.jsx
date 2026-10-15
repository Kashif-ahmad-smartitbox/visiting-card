import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, StatusBadge } from "@/components/Brand";
import { api, fmtDate, fmtPhone } from "@/lib/api";

export default function Messages() {
  const [rows, setRows] = useState([]);
  const [dir, setDir] = useState("all");
  useEffect(() => {
    api.get("/wa/messages", { params: { direction: dir } }).then((r) => setRows(r.data));
  }, [dir]);

  return (
    <div data-testid="messages-page">
      <PageHeader label="Audit trail" title="WhatsApp logs">
        <Tabs value={dir} onValueChange={setDir}>
          <TabsList className="bg-slate-900">
            <TabsTrigger value="all" data-testid="messages-tab-all">All</TabsTrigger>
            <TabsTrigger value="inbound" data-testid="messages-tab-inbound">Inbound</TabsTrigger>
            <TabsTrigger value="outbound" data-testid="messages-tab-outbound">Outbound</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>
      <div className="space-y-2" data-testid="messages-list">
        {rows.map((m) => (
          <div key={m.id} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-[160px_1fr_auto]" data-testid={`message-row-${m.id}`}>
            <div className="flex items-center gap-2 text-xs">
              {m.direction === "inbound" ? <ArrowDownLeft className="h-4 w-4 text-sky-400" /> : <ArrowUpRight className="h-4 w-4 text-emerald-400" />}
              <span className="font-mono">{fmtPhone(m.phone)}</span>
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{m.type}</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300 line-clamp-4">{m.body}</p>
              {m.error && <p className="mt-1 text-xs text-red-300">{m.error}</p>}
            </div>
            <div className="flex items-start gap-3 md:flex-col md:items-end">
              <StatusBadge status={m.status} />
              <span className="text-xs text-slate-500">{fmtDate(m.created_at)}</span>
            </div>
          </div>
        ))}
        {!rows.length && <p className="py-16 text-center text-sm text-slate-500">No messages yet.</p>}
      </div>
    </div>
  );
}
