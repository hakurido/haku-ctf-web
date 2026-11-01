import React from "react";
import { LoaderCircle } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** "ghost" is the design's quiet button. */
  variant?: ButtonVariant;
  size?: "md" | "sm";
  /**
   * A request is running. The button keeps focus and its normal colors, sets
   * aria-disabled="true" and data-busy, and ignores activation. Use `disabled`
   * only for controls that are unavailable.
   */
  busy?: boolean;
  children: React.ReactNode;
}

const BASE =
  "relative inline-flex items-center justify-center rounded-md text-ui font-medium select-none transition-[color,background-color,border-color,box-shadow] duration-120 ease-standard data-busy:cursor-progress";

const SIZE: Record<NonNullable<ButtonProps["size"]>, string> = {
  md: "h-9 px-4 gap-2",
  sm: "h-8 px-3 gap-1.5",
};

const UNAVAILABLE =
  "disabled:bg-surface-hover disabled:text-fg-disabled disabled:border disabled:border-line disabled:cursor-not-allowed";

// The data-busy:* resets keep the default colors on hover and press, so a busy
// control doesn't look clickable or unavailable.
const VARIANT: Record<ButtonVariant, string> = {
  // The primary action carries the approved accent halo token (2.1, hybrid look).
  primary: `bg-accent text-on-accent shadow-glow hover:bg-accent-hover hover:shadow-glow-strong active:bg-accent-active data-busy:hover:bg-accent data-busy:hover:shadow-glow data-busy:active:bg-accent disabled:shadow-none ${UNAVAILABLE}`,
  secondary: `bg-surface text-fg border border-line-control hover:bg-surface-hover hover:border-fg-muted active:bg-inset data-busy:hover:bg-surface data-busy:hover:border-line-control data-busy:active:bg-surface ${UNAVAILABLE}`,
  ghost:
    "bg-transparent text-fg-secondary hover:bg-surface-hover hover:text-fg active:bg-line active:text-fg data-busy:hover:bg-transparent data-busy:hover:text-fg-secondary data-busy:active:bg-transparent data-busy:active:text-fg-secondary disabled:text-fg-disabled disabled:bg-transparent disabled:cursor-not-allowed",
};

/**
 * Used as the click handler while busy. Enter, Space, and implicit form
 * submission all dispatch a click, so cancelling it also stops a submit.
 */
function ignoreActivation(event: React.MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      busy = false,
      disabled,
      className = "",
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        {...props}
        data-variant={variant}
        data-busy={busy ? "" : undefined}
        aria-disabled={busy ? "true" : props["aria-disabled"]}
        disabled={busy ? false : disabled}
        onClick={busy ? ignoreActivation : onClick}
        className={`${BASE} ${SIZE[size]} ${VARIANT[variant]} ${className}`}
      >
        {busy && (
          <LoaderCircle
            className="size-4 shrink-0 text-current motion-safe:animate-spin"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
