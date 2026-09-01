"use client";

import { COUNTRIES, flagEmoji } from "@/lib/countries";

export default function PhoneInput({
  dialCode,
  onDialCodeChange,
  number,
  onNumberChange,
  required,
}: {
  dialCode: string;
  onDialCodeChange: (v: string) => void;
  number: string;
  onNumberChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <select
        value={dialCode}
        onChange={(e) => onDialCodeChange(e.target.value)}
        className="w-32 shrink-0 rounded border border-white/15 bg-[#0d1310] px-2 py-2 text-sm text-[#EAF3EE]"
      >
        {COUNTRIES.map((c) => (
          <option key={c.iso2} value={c.dialCode}>
            {flagEmoji(c.iso2)} {c.dialCode}
          </option>
        ))}
      </select>
      <input
        required={required}
        type="tel"
        inputMode="numeric"
        value={number}
        onChange={(e) => onNumberChange(e.target.value.replace(/[^\d]/g, ""))}
        placeholder="8012345678"
        className="w-full rounded border border-white/15 bg-[#0d1310] px-3 py-2 text-[#EAF3EE] placeholder:text-[#8FA89C]/50"
      />
    </div>
  );
}
