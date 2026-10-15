import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Mic, Paperclip, Send, Square, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/Brand";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg, fmtPhone } from "@/lib/api";

function Bubble({ m }) {
  const mine = m.from === "me";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed shadow ${mine ? "rounded-tr-none bg-[#005c4b]" : "rounded-tl-none bg-[#202c33]"}`} data-testid={mine ? "sim-msg-user" : "sim-msg-bot"}>
        {m.text}
        {m.contacts?.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {m.contacts.slice(0, 3).map((c) => (
              <div key={c.id} className="rounded-md bg-black/20 px-2.5 py-1.5 text-xs">
                <span className="font-semibold text-emerald-300">vCard</span> · {c.contact_person || c.company_name} · {fmtPhone(c.mobile)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Simulator() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState([{ from: "bot", text: "Send a visiting card photo/PDF, or ask for contacts by text or voice — e.g. \"solar companies in Gujarat\"." }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState(null);
  const fileRef = useRef();
  const endRef = useRef();
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const push = (m) => setMsgs((x) => [...x, m]);
  const send = async (fd, label) => {
    push({ from: "me", text: label });
    setBusy(true);
    try {
      const { data } = await api.post("/wa/simulate", fd);
      if (data.transcript) push({ from: "bot", text: `Transcribed: "${data.transcript}"` });
      push({ from: "bot", text: data.reply, contacts: data.contacts });
    } catch (e) {
      push({ from: "bot", text: errMsg(e) });
    } finally { setBusy(false); }
  };
  const sendText = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const fd = new FormData();
    fd.append("text", text);
    send(fd, text);
    setText("");
  };
  const sendFile = (f) => {
    const fd = new FormData();
    fd.append("file", f);
    send(fd, `[${f.type === "application/pdf" ? "PDF" : "Photo"}] ${f.name}`);
  };
  const toggleRec = async () => {
    if (rec) { rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        sendFile(new File([blob], "voice-note.webm", { type: "audio/webm" }));
      };
      mr.start();
      setRec(mr);
    } catch (e) { toast.error("Microphone access denied"); }
  };

  return (
    <div data-testid="simulator-page">
      <PageHeader label="Test bench" title="WhatsApp simulator" />
      <p className="mb-6 max-w-2xl text-sm text-slate-400">
        Acts exactly like a message from your WhatsApp number ({user.mobile ? `+${user.mobile}` : <Link to="/app/settings" className="text-emerald-400 underline">add your number</Link>}). Uses the same AI extraction, contact notifications and search as real WhatsApp.
      </p>
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#111b21]">
        <div className="flex items-center gap-3 bg-[#202c33] px-4 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 font-bold text-slate-950">C</div>
          <div><div className="text-sm font-semibold">CardPulse Assistant</div><div className="text-[11px] text-emerald-300">{busy ? "typing..." : "online"}</div></div>
        </div>
        <div className="wa-wall h-[460px] space-y-3 overflow-y-auto p-4" data-testid="sim-chat">
          {msgs.map((m, i) => <Bubble key={i} m={m} />)}
          {busy && <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3 w-3 animate-spin" />processing</div>}
          <div ref={endRef} />
        </div>
        <form onSubmit={sendText} className="flex items-center gap-2 bg-[#202c33] p-3">
          <button type="button" onClick={() => fileRef.current.click()} disabled={busy} className="p-2 text-slate-400 hover:text-emerald-300" data-testid="wa-simulator-attach-button"><Paperclip className="h-5 w-5" /></button>
          <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" data-testid="wa-simulator-file-input" onChange={(e) => { if (e.target.files[0]) sendFile(e.target.files[0]); e.target.value = ""; }} />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" className="flex-1 rounded-full bg-[#2a3942] px-4 py-2.5 text-sm outline-none placeholder:text-slate-500" data-testid="wa-simulator-input" />
          {text ? (
            <button type="submit" disabled={busy} className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-slate-950" data-testid="wa-simulator-send-button"><Send className="h-4 w-4" /></button>
          ) : (
            <button type="button" onClick={toggleRec} disabled={busy} className={`grid h-10 w-10 place-items-center rounded-full ${rec ? "bg-red-500" : "bg-emerald-500"} text-slate-950`} data-testid="wa-simulator-voice-button">
              {rec ? <Square className="h-4 w-4 pulse-dot" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
