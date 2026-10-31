"use client";

import React, { useId } from "react";
import { CircleX } from "lucide-react";

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  error?: string | null;
  mono?: boolean;
}

export function TextField({
  label,
  description,
  error,
  mono = false,
  id: explicitId,
  className = "",
  ...props
}: FieldProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const descId = `${id}-desc`;
  const errId = `${id}-err`;

  const describedBy = [
    description ? descId : null,
    error ? errId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-ui font-medium text-fg mb-1.5">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? "true" : undefined}
        className={`h-9 w-full rounded-md border border-line-control bg-inset px-3 text-ui text-fg placeholder:text-fg-muted hover:border-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus aria-invalid:border-error disabled:bg-canvas disabled:border-line disabled:text-fg-disabled disabled:cursor-not-allowed ${
          mono ? "font-mono text-code" : ""
        } ${className}`}
        {...props}
      />
      {description && (
        <p id={descId} className="text-caption text-fg-muted mt-1.5">
          {description}
        </p>
      )}
      {error && (
        <p id={errId} className="mt-1.5 flex items-center gap-1.5 text-caption text-error font-medium">
          <CircleX className="size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export interface TextAreaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  description?: string;
  error?: string | null;
  mono?: boolean;
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
  const descId = `${id}-desc`;
  const errId = `${id}-err`;

  const describedBy = [
    description ? descId : null,
    error ? errId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-ui font-medium text-fg mb-1.5">
        {label}
      </label>
      <textarea
        id={id}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? "true" : undefined}
        className={`min-h-24 py-2 w-full rounded-md border border-line-control bg-inset px-3 text-ui text-fg placeholder:text-fg-muted hover:border-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus aria-invalid:border-error resize-y disabled:bg-canvas disabled:border-line disabled:text-fg-disabled disabled:cursor-not-allowed ${
          mono ? "font-mono text-code" : ""
        } ${className}`}
        {...props}
      />
      {description && (
        <p id={descId} className="text-caption text-fg-muted mt-1.5">
          {description}
        </p>
      )}
      {error && (
        <p id={errId} className="mt-1.5 flex items-center gap-1.5 text-caption text-error font-medium">
          <CircleX className="size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
