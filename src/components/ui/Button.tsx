import React from "react";
import { LoaderCircle } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  busy?: boolean;
  children: React.ReactNode;
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
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus select-none";

    const sizeClasses =
      size === "sm" ? "h-8 px-3 text-caption gap-1.5" : "h-9 px-4 text-ui gap-2";

    let variantClasses = "";
    if (variant === "primary") {
      variantClasses =
        "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active disabled:bg-surface-hover disabled:text-fg-disabled disabled:border disabled:border-line disabled:cursor-not-allowed";
    } else if (variant === "secondary") {
      variantClasses =
        "bg-surface text-fg border border-line-control hover:bg-surface-hover hover:border-fg-muted active:bg-inset disabled:bg-surface-hover disabled:text-fg-disabled disabled:border-line disabled:cursor-not-allowed";
    } else if (variant === "ghost") {
      variantClasses =
        "bg-transparent text-fg-secondary hover:bg-surface-hover hover:text-fg active:bg-line active:text-fg disabled:text-fg-disabled disabled:bg-transparent disabled:cursor-not-allowed";
    }

    return (
      <button
        ref={ref}
        disabled={disabled || busy}
        data-busy={busy ? "" : undefined}
        className={`${baseClasses} ${sizeClasses} ${variantClasses} ${
          busy ? "cursor-progress" : ""
        } ${className}`}
        {...props}
      >
        {busy && <LoaderCircle className="size-4 animate-spin text-current shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
