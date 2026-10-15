import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const ORG_FIELDS = [
  { key: "org_name", label: "Organisation name", testid: "org-name-input", required: true },
  { key: "gstin", label: "GSTIN (optional)", testid: "org-gstin-input", placeholder: "24AAACA1234A1Z5" },
  { key: "mobile", label: "Admin WhatsApp mobile", testid: "org-mobile-input", required: true, placeholder: "+91 98765 43210" },
  { key: "address", label: "Address", testid: "org-address-input", required: true, area: true },
];

export function Field({ f, value, onChange }) {
  const Comp = f.area ? Textarea : Input;
  return (
    <div className={`space-y-2 ${f.area ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={f.key}>{f.label}</Label>
      <Comp
        id={f.key}
        type={f.type || "text"}
        required={f.required}
        placeholder={f.placeholder}
        data-testid={f.testid}
        value={value}
        onChange={(e) => onChange(f.key, f.key === "gstin" ? e.target.value.toUpperCase() : e.target.value)}
        className={`bg-slate-900 ${f.area ? "min-h-[80px]" : "h-11"}`}
      />
    </div>
  );
}
