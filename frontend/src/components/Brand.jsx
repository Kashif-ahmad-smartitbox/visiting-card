import { ScanLine } from "lucide-react";
import { Link } from "react-router-dom";

export const Logo = ({ to = "/" }) => (
  <Link to={to} className="flex items-center gap-2.5 group" data-testid="brand-logo">
    <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500 text-slate-950 transition-transform duration-300 group-hover:rotate-6">
      <ScanLine className="h-5 w-5" strokeWidth={2.5} />
    </span>
    <span className="font-display text-xl font-extrabold tracking-tight">
      Card<span className="text-emerald-400">Pulse</span>
    </span>
  </Link>
);

export const Label2 = ({ children }) => (
  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400">{children}</span>
);

export const GoogleButton = ({ onClick, testid }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium transition-colors duration-200 hover:bg-slate-800"
  >
    <svg className="h-4 w-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
    Continue with Google
  </button>
);

export const StatusBadge = ({ status }) => {
  const map = {
    sent: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    received: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    simulated: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    failed: "bg-red-500/10 text-red-300 border-red-500/30",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${map[status] || map.received}`}>
      {status}
    </span>
  );
};

export const SourceBadge = ({ source }) => (
  <span
    className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
      source === "whatsapp" ? "border-[#25D366]/30 bg-[#25D366]/10 text-[#4ade80]" : "border-sky-500/30 bg-sky-500/10 text-sky-300"
    }`}
  >
    {source === "whatsapp" ? "WhatsApp" : "Panel"}
  </span>
);

export const PageHeader = ({ label, title, children }) => (
  <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between rise">
    <div>
      <Label2>{label}</Label2>
      <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">{title}</h1>
    </div>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </div>
);
