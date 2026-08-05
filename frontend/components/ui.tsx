"use client";

import { ReactNode } from "react";
import { Search } from "lucide-react";

export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="cso-card p-6">
      <div className="cso-section-head">
        <div>
          <h2 className="cso-page-title">{title}</h2>
          {description ? <p className="cso-page-desc mt-1">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
      />
      <input
        className="cso-input pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function ProviderSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: number | string; name: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
      <span className="whitespace-nowrap">选择服务商：</span>
      <select
        className="cso-input w-auto min-w-[7rem]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">全部</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Modal({
  children,
  onClose,
  wide,
}: {
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="cso-modal-mask" onClick={onClose}>
      <div
        className={`cso-modal ${wide ? "max-w-2xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
