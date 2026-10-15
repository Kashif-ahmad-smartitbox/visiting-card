import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutGrid, ScanLine, Users, Contact, MessageSquareText, Settings as Cog, LogOut, Menu, Radio } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/Brand";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutGrid, end: true, id: "dashboard" },
  { to: "/app/scan", label: "Scan Cards", icon: ScanLine, id: "scan" },
  { to: "/app/contacts", label: "Contacts", icon: Contact, id: "contacts" },
  { to: "/app/team", label: "Team", icon: Users, id: "team" },
  { to: "/app/simulator", label: "WA Simulator", icon: Radio, id: "simulator" },
  { to: "/app/messages", label: "WhatsApp Logs", icon: MessageSquareText, id: "messages" },
  { to: "/app/settings", label: "Settings", icon: Cog, id: "settings" },
];

function NavItems({ onNav }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end, id }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNav}
          data-testid={`nav-item-${id}`}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
              isActive ? "bg-emerald-500/10 text-emerald-300" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
            }`
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserBox() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="truncate text-sm font-semibold" data-testid="shell-user-name">{user.name}</div>
      <div className="truncate text-xs text-slate-500">{user.org?.name} · {user.role}</div>
      <button
        data-testid="logout-button"
        onClick={async () => { await logout(); navigate("/login"); }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 py-1.5 text-xs text-slate-300 transition-colors hover:border-red-500/50 hover:text-red-300"
      >
        <LogOut className="h-3.5 w-3.5" /> Log out
      </button>
    </div>
  );
}

export default function AppShell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="grain min-h-screen bg-[#0B0F17]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between border-r border-slate-800/80 bg-[#0d1220] p-5 lg:flex">
        <div className="space-y-8">
          <Logo to="/app" />
          <NavItems />
        </div>
        <UserBox />
      </aside>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo to="/app" />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button data-testid="mobile-menu-button" className="rounded-md border border-slate-700 p-2"><Menu className="h-5 w-5" /></button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col justify-between border-slate-800 bg-[#0d1220] p-5">
            <div className="space-y-8 pt-4"><Logo to="/app" /><NavItems onNav={() => setOpen(false)} /></div>
            <UserBox />
          </SheetContent>
        </Sheet>
      </header>
      <main className="relative z-10 lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
