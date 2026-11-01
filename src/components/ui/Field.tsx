"use client";

import React, { useId } from "react";
import { CircleX, TriangleAlert } from "lucide-react";

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  error?: string | null;
  /** A non-blocking note (2.16): described by the field, but not aria-invalid. */
  warning?: string | null;
  /** Data fields (flag, hex key, predictions) use the mono face. */
  mono?: boolean;
}

export interface TextAreaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  description?: string;
  error?: string | null;
  mono?: boolean;
}

// The focus ring comes from the global :focus-visible outline; the border stays as is.
const CONTROL =
  "w-full rounded-md border border-line-control bg-inset px-3 text-fg placeholder:text-fg-muted transition-colors duration-120 ease-standard hover:border-fg-muted aria-invalid:border-error disabled:bg-canvas disabled:border-line disabled:text-fg-disabled disabled:cursor-not-allowed";

const MONO = "font-mono text-code";

function fieldIds(
  id: string,
  description?: string,
  error?: string | null,
  warning?: string | null,
  extra?: string
) {
  const descId = `${id}-desc`;
  const errId = `${id}-err`;
  const warnId = `${id}-warn`;
  const describedBy = [
    description ? descId : null,
    error ? errId : null,
    !error && warning ? warnId : null,
    extra || null,
  ]
    .filter(Boolean)
    .join(" ");
  return { descId, errId, warnId, describedBy: describedBy || undefined };
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-ui font-medium text-fg mb-1.5">
      {children}
    </label>
  );
}

function FieldMessages({
  descId,
  errId,
  warnId,
  description,
  error,
  warning,
}: {
  descId: string;
  errId: string;
  warnId: string;
  description?: string;
  error?: string | null;
  warning?: string | null;
}) {
  return (
    <>
      {description && (
        <p id={descId} className="mt-1.5 text-ui text-fg-muted">
          {description}
        </p>
      )}
      {error ? (
        <p id={errId} className="mt-1.5 flex items-start gap-1.5 text-ui text-error">
          <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : (
        warning && (
          <p id={warnId} className="mt-1.5 flex items-start gap-1.5 text-ui text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{warning}</span>
          </p>
        )
      )}
    </>
  );
}

export function TextField({
  label,
  description,
  error,
  warning,
  mono = false,
  id: explicitId,
  className = "",
  "aria-describedby": extraDescribedBy,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const { descId, errId, warnId, describedBy } = fieldIds(
    id,
    description,
    error,
    warning,
    extraDescribedBy
  );

  return (
    <div className="w-full">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : undefined}
        data-mono={mono ? "" : undefined}
        className={`h-9 ${CONTROL} ${mono ? MONO : "text-ui"} ${className}`}
        {...props}
      />
      <FieldMessages
        descId={descId}
        errId={errId}
        warnId={warnId}
        description={description}
        error={error}
        warning={warning}
      />
    </div>
  );
}

export function TextAreaField({
  label,
  description,
  error,
  mono = false,
  id: explicitId,
  className = "",
  ...props
}: TextAreaFieldProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const { descId, errId, warnId, describedBy } = fieldIds(id, description, error);

  return (
    <div className="w-full">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <textarea
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : undefined}
        data-mono={mono ? "" : undefined}
        className={`min-h-24 py-2 resize-y ${CONTROL} ${mono ? MONO : "text-ui"} ${className}`}
        {...props}
      />
      <FieldMessages
        descId={descId}
        errId={errId}
        warnId={warnId}
        description={description}
        error={error}
      />
    </div>
  );
}
