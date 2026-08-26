"use client";

import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";

const CONTROL_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400 placeholder:text-slate-400";

const LABEL_CLASS = "block text-sm font-medium text-slate-700";
const HINT_CLASS = "mt-1 text-xs text-slate-400";

export { CONTROL_CLASS };

function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className={LABEL_CLASS}>
      {children}
      {required ? <span className="ml-0.5 text-accent">*</span> : null}
    </label>
  );
}

interface BaseFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  id?: string;
  /** Apply font-hindi to the control (useful for Hindi free text). */
  hindi?: boolean;
}

/** Labeled text input. */
export function Field({
  label,
  hint,
  id,
  hindi,
  className = "",
  required,
  ...rest
}: BaseFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      <Label htmlFor={fieldId} required={required}>
        {label}
      </Label>
      <input
        id={fieldId}
        required={required}
        className={`mt-1 ${CONTROL_CLASS} ${hindi ? "font-hindi" : ""} ${className}`}
        {...rest}
      />
      {hint ? <p className={HINT_CLASS}>{hint}</p> : null}
    </div>
  );
}

/** Labeled select. Pass <option> children. */
export function SelectField({
  label,
  hint,
  id,
  required,
  className = "",
  children,
  ...rest
}: BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      <Label htmlFor={fieldId} required={required}>
        {label}
      </Label>
      <select
        id={fieldId}
        required={required}
        className={`mt-1 ${CONTROL_CLASS} ${className}`}
        {...rest}
      >
        {children}
      </select>
      {hint ? <p className={HINT_CLASS}>{hint}</p> : null}
    </div>
  );
}

/** Labeled textarea. */
export function TextareaField({
  label,
  hint,
  id,
  hindi,
  required,
  className = "",
  ...rest
}: BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      <Label htmlFor={fieldId} required={required}>
        {label}
      </Label>
      <textarea
        id={fieldId}
        required={required}
        className={`mt-1 ${CONTROL_CLASS} ${hindi ? "font-hindi" : ""} ${className}`}
        {...rest}
      />
      {hint ? <p className={HINT_CLASS}>{hint}</p> : null}
    </div>
  );
}
