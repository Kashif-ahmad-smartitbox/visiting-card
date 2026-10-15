import { Link } from "react-router-dom";
import { ArrowRight, Camera, FileText, Mic, Send, Sparkles, UserCheck, Building2, Check } from "lucide-react";
import { Logo, Label2 } from "@/components/Brand";
import { useAuth } from "@/context/AuthContext";

const FEATURES = [
  { icon: Camera, title: "Snap & send on WhatsApp", body: "Team members forward a photo or PDF of any visiting card to one WhatsApp number. We know who sent it." },
  { icon: Sparkles, title: "AI extraction in seconds", body: "Company, person, designation, mobile, email and address are read and filed into your organisation." },
  { icon: UserCheck, title: "Instant vCard handshake", body: "The new contact immediately receives your company profile and the sender's vCard on WhatsApp." },
  { icon: Mic, title: "Ask by voice or text", body: "\"Solar vendors in Gujarat?\" Send a voice note or text and get matching contacts back in chat." },
];

const STEPS = [
  ["01", "Register your organisation", "Organisation name, GSTIN, address and admin WhatsApp number."],
  ["02", "Add your team", "Every member's WhatsApp number becomes a secure scanner tied to your panel."],
  ["03", "Send cards, search anytime", "Cards from WhatsApp or bulk panel uploads land in one searchable directory."],
];

function PhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-sm rise" style={{ animationDelay: "200ms" }}>
      <div className="absolute -inset-6 rounded-[2.5rem] bg-emerald-500/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-700 bg-[#111b21] shadow-2xl">
        <div className="flex items-center gap-3 bg-[#202c33] px-4 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-slate-950 font-bold">C</div>
          <div><div className="text-sm font-semibold">CardPulse</div><div className="text-[11px] text-emerald-300">online</div></div>
        </div>
        <div className="wa-wall space-y-3 p-4 text-[13px]">
          <div className="ml-auto w-48 rounded-lg rounded-tr-none bg-[#005c4b] p-1.5">
            <div className="relative h-28 overflow-hidden rounded-md bg-gradient-to-br from-slate-100 to-slate-300 p-3 text-slate-800">
              <div className="text-[11px] font-bold">APEX INDUSTRIAL TECH</div>
              <div className="mt-3 text-[10px] font-semibold">Sanjay Verma</div>
              <div className="text-[9px]">Managing Director</div>
              <div className="text-[9px]">+91 98201 44512</div>
              <div className="scanline absolute inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_12px_#10b981]" />
            </div>
          </div>
          <div className="w-60 rounded-lg rounded-tl-none bg-[#202c33] p-2.5 leading-relaxed">
            <span className="font-semibold text-emerald-300">Saved 1 contact</span> to your organisation
            <div className="mt-1 text-slate-300">Sanjay Verma · Apex Industrial · +91 98201 44512</div>
            <div className="mt-1 text-[11px] text-slate-400">Contact received your company profile & vCard.</div>
          </div>
          <div className="ml-auto w-44 rounded-lg rounded-tr-none bg-[#005c4b] p-2.5 flex items-center gap-2">
            <Mic className="h-4 w-4" /><div className="h-1 flex-1 rounded bg-emerald-200/50" /><span className="text-[10px]">0:04</span>
          </div>
          <div className="w-56 rounded-lg rounded-tl-none bg-[#202c33] p-2.5">Found 2 contacts for "industrial automation in Gujarat"</div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="grain min-h-screen bg-[#0B0F17]">
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/app" data-testid="landing-open-panel" className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400">Open panel</Link>
            ) : (
              <>
                <Link to="/login" data-testid="landing-login-link" className="rounded-full px-4 py-2 text-sm text-slate-300 transition-colors hover:text-white">Log in</Link>
                <Link to="/register" data-testid="landing-register-link" className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400">Register organisation</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="grid-lines relative">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 py-20 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:px-8 lg:py-28">
          <div className="rise">
            <Label2>WhatsApp-native contact intelligence</Label2>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Every visiting card, <span className="text-emerald-400">captured</span> the moment it lands on WhatsApp.
            </h1>
            <p className="mt-6 max-w-xl text-base text-slate-400 sm:text-lg">
              Your team sends a card photo, PDF or camera shot. CardPulse extracts the details, files them under your organisation with who added it, and greets the new contact with your company profile and vCard.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/register" data-testid="hero-register-button" className="group inline-flex items-center gap-2 rounded-full bg-emerald-500 px-7 py-3.5 font-semibold text-slate-950 transition-colors hover:bg-emerald-400">
                Register your organisation <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/login" data-testid="hero-login-button" className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-7 py-3.5 font-medium text-slate-200 transition-colors hover:border-emerald-500/60">
                Log in to panel
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-400">
              {["Photo, PDF & camera", "Bulk panel uploads", "Voice-note search"].map((t) => (
                <span key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />{t}</span>
              ))}
            </div>
          </div>
          <PhoneMock />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <Label2>What it does</Label2>
        <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">One WhatsApp number. Your whole team's network, organised.</h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 md:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="group bg-[#0f1523] p-8 transition-colors duration-300 hover:bg-[#121a2b] lg:p-10 rise" style={{ animationDelay: `${i * 80}ms` }}>
              <Icon className="h-6 w-6 text-emerald-400 transition-transform duration-300 group-hover:-translate-y-1" />
              <h3 className="mt-6 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-800 bg-[#0d1220]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-3 lg:px-8">
          {STEPS.map(([n, t, b]) => (
            <div key={n}>
              <div className="font-mono text-5xl font-medium text-slate-700">{n}</div>
              <h3 className="mt-4 text-lg font-bold">{t}</h3>
              <p className="mt-2 text-sm text-slate-400">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-10 md:flex-row md:items-center lg:p-14">
          <div>
            <div className="flex gap-3 text-emerald-400"><Building2 /><FileText /><Send /></div>
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Start capturing cards today.</h2>
            <p className="mt-2 text-slate-400">Register in under a minute — you'll get a WhatsApp confirmation instantly.</p>
          </div>
          <Link to="/register" data-testid="cta-register-button" className="rounded-full bg-emerald-500 px-7 py-3.5 font-semibold text-slate-950 transition-colors hover:bg-emerald-400">Get started</Link>
        </div>
      </section>
      <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-500">© {new Date().getFullYear()} CardPulse</footer>
    </div>
  );
}
