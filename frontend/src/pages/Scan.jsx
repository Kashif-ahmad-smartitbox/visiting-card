import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Camera, FileText, ImageIcon, Loader2, UploadCloud, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/Brand";
import { api, errMsg, fmtPhone } from "@/lib/api";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function QueueItem({ item, onRemove }) {
  const Icon = item.file.type === "application/pdf" ? FileText : ImageIcon;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3" data-testid={`queue-item-${item.id}`}>
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="flex-1 truncate text-sm">{item.file.name}</span>
      {item.status === "working" && <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />}
      {item.status === "done" && <span className="flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="h-4 w-4" />{item.count} saved</span>}
      {item.status === "error" && <span className="flex items-center gap-1 text-xs text-red-300"><AlertCircle className="h-4 w-4" />{item.error}</span>}
      {item.status === "queued" && (
        <button onClick={() => onRemove(item.id)} data-testid={`queue-remove-${item.id}`} className="text-slate-500 hover:text-red-300"><X className="h-4 w-4" /></button>
      )}
    </li>
  );
}

function ResultsTable({ rows }) {
  if (!rows.length) return null;
  return (
    <section className="mt-10 rise" data-testid="scan-results">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">Extracted & saved ({rows.length})</h3>
        <Link to="/app/contacts" className="text-sm text-emerald-400 hover:underline" data-testid="scan-view-contacts">Open contacts</Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>{["Company", "Contact person", "Designation", "Mobile", "Email", "Address", "WA"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((c) => (
              <tr key={c.id} data-testid={`scan-result-${c.id}`} className="hover:bg-slate-900/50">
                <td className="px-4 py-3 font-medium">{c.company_name || "—"}</td>
                <td className="px-4 py-3">{c.contact_person || "—"}</td>
                <td className="px-4 py-3 text-slate-400">{c.designation || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{fmtPhone(c.mobile)}</td>
                <td className="px-4 py-3 text-slate-400">{c.email || "—"}</td>
                <td className="max-w-[220px] truncate px-4 py-3 text-slate-400">{c.address || "—"}</td>
                <td className="px-4 py-3 text-xs">{c.wa_notified ? <span className="text-emerald-300">Notified</span> : <span className="text-slate-500">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Scan() {
  const [queue, setQueue] = useState([]);
  const [results, setResults] = useState([]);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();
  const camRef = useRef();

  const add = (files) => {
    const ok = Array.from(files).filter((f) => ACCEPT.split(",").includes(f.type));
    if (ok.length < files.length) toast.error("Only JPG, PNG, WEBP and PDF files are supported");
    setQueue((q) => [...q, ...ok.map((file) => ({ id: Math.random().toString(36).slice(2, 9), file, status: "queued" }))]);
  };
  const patch = (id, p) => setQueue((q) => q.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const runOne = async (item) => {
    patch(item.id, { status: "working" });
    const fd = new FormData();
    fd.append("files", item.file);
    fd.append("notify", notify);
    try {
      const { data } = await api.post("/contacts/scan", fd);
      const r = data.results[0];
      if (r.error) patch(item.id, { status: "error", error: r.error });
      else patch(item.id, { status: "done", count: r.contacts.length });
      setResults((rs) => [...r.contacts, ...rs]);
      return r.contacts.length;
    } catch (e) {
      patch(item.id, { status: "error", error: errMsg(e) });
      return 0;
    }
  };

  const extract = async () => {
    const pending = queue.filter((q) => q.status === "queued");
    if (!pending.length) return;
    setBusy(true);
    const counts = await Promise.all(pending.map(runOne));
    setBusy(false);
    const total = counts.reduce((a, b) => a + b, 0);
    toast.success(`${total} contact(s) extracted and saved`, notify ? { description: "WhatsApp notifications dispatched to contacts" } : undefined);
  };

  const pendingCount = queue.filter((q) => q.status === "queued").length;
  return (
    <div data-testid="scan-page">
      <PageHeader label="Extraction studio" title="Scan visiting cards" />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div
          data-testid="bulk-upload-dropzone"
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
          onClick={() => fileRef.current.click()}
          className={`relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-10 text-center transition-colors duration-300 ${drag ? "border-emerald-400 bg-emerald-500/10" : "border-slate-700 bg-slate-900/40 hover:border-emerald-500/50"}`}
        >
          {busy && <div className="scanline absolute inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_16px_#10b981]" />}
          <UploadCloud className="h-10 w-10 text-emerald-400" />
          <h3 className="mt-4 text-xl font-bold">Drop cards here or click to browse</h3>
          <p className="mt-2 text-sm text-slate-400">Multiple JPG, PNG, WEBP or PDF files. Front & back on one PDF is fine.</p>
          <input ref={fileRef} type="file" multiple accept={ACCEPT} hidden data-testid="bulk-upload-input" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <Button variant="outline" data-testid="camera-scan-trigger" onClick={() => camRef.current.click()} className="h-12 border-slate-700 bg-slate-950">
            <Camera className="mr-2 h-4 w-4" /> Capture with camera
          </Button>
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden data-testid="camera-input" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm">
            <span><span className="font-medium">Notify contacts on WhatsApp</span><span className="block text-xs text-slate-500">Send your company profile & vCard</span></span>
            <Switch checked={notify} onCheckedChange={setNotify} data-testid="notify-toggle" />
          </label>
          <ul className="max-h-64 space-y-2 overflow-y-auto" data-testid="upload-queue">
            {queue.map((item) => <QueueItem key={item.id} item={item} onRemove={(id) => setQueue((q) => q.filter((x) => x.id !== id))} />)}
            {!queue.length && <li className="py-6 text-center text-sm text-slate-500">No files added yet</li>}
          </ul>
          <Button data-testid="extract-cards-button" disabled={busy || !pendingCount} onClick={extract} className="mt-auto h-12 bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-400">
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extracting with AI...</> : `Extract & save ${pendingCount || ""} file(s)`}
          </Button>
        </div>
      </div>
      <ResultsTable rows={results} />
    </div>
  );
}
