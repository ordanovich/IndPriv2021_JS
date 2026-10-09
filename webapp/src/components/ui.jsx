import React, { useState } from "react";

export function Section({ title, right, children, defaultOpen = true, open: openProp, onToggle }) {
  const [openState, setOpen] = useState(defaultOpen);
  const open = openProp ?? openState;
  const toggle = () => (onToggle ? onToggle(!open) : setOpen(!open));
  return (
    <section className={"section" + (open ? " open" : "")}>
      <header className="section-head">
        <button className="section-toggle" onClick={toggle} aria-expanded={open}>
          <span className="chev">{open ? "▾" : "▸"}</span>
          <span className="section-title">{title}</span>
        </button>
        {right}
      </header>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

export function Segmented({ options, value, onChange, size }) {
  return (
    <div className={"segmented" + (size ? " " + size : "")} role="radiogroup">
      {options.map(o => (
        <button key={o.value} role="radio" aria-checked={value === o.value}
                className={value === o.value ? "on" : ""} disabled={o.disabled}
                title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <div className="field">
      {label && <div className="field-label">{label}</div>}
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function Check({ checked, onChange, children, disabled }) {
  return (
    <label className={"check" + (disabled ? " disabled" : "")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function QuintileChip({ q, colors, labels }) {
  if (!(q >= 1 && q <= 5)) return <span className="qchip none">—</span>;
  return (
    <span className="qchip">
      <i style={{ background: colors[q - 1] }} />Q{q}{labels ? " · " + labels[q - 1] : ""}
    </span>
  );
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).catch(() => fallback(text));
  fallback(text);
  return Promise.resolve();
}
function fallback(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (_) { /* ignore */ }
  document.body.removeChild(ta);
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
