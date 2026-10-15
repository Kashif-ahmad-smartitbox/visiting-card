import { Logo, Label2 } from "@/components/Brand";

export default function AuthLayout({ label, title, sub, children }) {
  return (
    <div className="grain grid min-h-screen bg-[#0B0F17] lg:grid-cols-[1fr_1.1fr]">
      <div className="grid-lines relative hidden flex-col justify-between border-r border-slate-800 p-12 lg:flex">
        <Logo />
        <div>
          <Label2>{label}</Label2>
          <h2 className="mt-4 max-w-md text-4xl font-extrabold leading-tight tracking-tight">
            Cards in. <span className="text-emerald-400">Connections</span> out.
          </h2>
          <p className="mt-4 max-w-sm text-slate-400">
            Your team's visiting cards, extracted by AI and shared back over WhatsApp — automatically.
          </p>
        </div>
        <div className="font-mono text-xs text-slate-600">WHATSAPP · AI EXTRACTION · VCARD</div>
      </div>
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md rise">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-slate-400">{sub}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
