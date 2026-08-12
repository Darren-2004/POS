import React from 'react';

export default function Field({ label, children, required }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
        {label}{required && <span className="ml-0.5 text-gold">*</span>}
      </label>
      {children}
    </div>
  );
}

export const inputCls = "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-foreground outline-none placeholder:text-foreground/30 focus:border-gold/50";