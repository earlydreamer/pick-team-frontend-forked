import React, { forwardRef, useEffect, useId, useRef } from 'react';
import './tokens.css';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' };
export function DesignButton({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`ds-button ds-button-${variant} ${className}`} {...props} />;
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string; error?: string };
export const DesignField = forwardRef<HTMLInputElement, FieldProps>(function DesignField({ label, help, error, id, className, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }, ref) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const descriptionId = `${inputId}-description`;
  const descriptions = [describedBy, help || error ? descriptionId : null].filter(Boolean).join(' ') || undefined;
  return <div className="ds-field"><label className="ds-label" htmlFor={inputId}>{label}</label><input {...props} ref={ref} id={inputId} className={`ds-input ${className || ''}`} aria-invalid={error ? true : invalid} aria-describedby={descriptions} />{(help || error) && <p id={descriptionId} className={`ds-help ${error ? 'ds-error' : ''}`}>{error || help}</p>}</div>;
});
export function DesignCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="ds-card"><h3>{title}</h3>{children}</section>;
}
export function DesignBadge({ tone = 'primary', children }: { tone?: 'primary' | 'success' | 'warning' | 'error'; children: React.ReactNode }) {
  return <span className={`ds-badge ds-badge-${tone}`}>{children}</span>;
}
export function DesignDialog({ open, onClose, title, children, actions }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; actions: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const node = dialog.current; if (!node) return; if (open && !node.open) node.showModal(); if (!open && node.open) node.close(); }, [open]);
  return <dialog className="ds-dialog" ref={dialog} onClose={onClose} aria-labelledby={titleId}><h2 id={titleId}>{title}</h2>{children}<div className="ds-dialog-actions">{actions}</div></dialog>;
}
