"use client";

import React, { useEffect, useId, useRef } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import { FlagForm } from "../flag/FlagForm";
import { Announcer } from "../state/Announcer";
import { useAppState } from "../state/AppStateProvider";

export function FlagDialog() {
  const { setFlagDialogOpen } = useAppState();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const handleId = useId();
  const flagId = useId();
  const pathname = usePathname();

  // The form is always rendered, so it exists when showModal() moves focus (R-38).
  const openDialog = () => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    setFlagDialogOpen(true);
    const handle = document.getElementById(handleId) as HTMLInputElement | null;
    const flag = document.getElementById(flagId) as HTMLInputElement | null;
    const firstEmpty = !handle?.value.trim() ? handle : !flag?.value.trim() ? flag : handle;
    firstEmpty?.focus();
  };

  const closeDialog = () => {
    dialogRef.current?.close();
  };

  // A route change (including the back button) closes the dialog (R-38).
  useEffect(() => {
    if (dialogRef.current?.open) dialogRef.current.close();
  }, [pathname]);

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        onClick={openDialog}
        aria-haspopup="dialog"
        className="font-medium whitespace-nowrap"
      >
        Submit flag
      </Button>

      <dialog
        ref={dialogRef}
        // Fires for Escape, the Close button, and the route-change close.
        onClose={() => setFlagDialogOpen(false)}
        aria-labelledby={headingId}
        className="w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-accent/40 border-t-2 border-t-accent bg-surface p-5 text-fg shadow-dialog backdrop:bg-backdrop motion-safe:animate-dialog-in"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
          <h2 id={headingId} className="text-title text-fg font-semibold">
            Submit a flag
          </h2>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close"
            className="size-8 inline-flex items-center justify-center rounded-md text-fg-secondary hover:bg-surface-hover hover:text-fg"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <FlagForm variant="dialog" handleId={handleId} flagId={flagId} />

        {/* The page outside a modal dialog is inert, so results announced while it
            is open need a live region inside it (R-37). The provider routes each
            message to exactly one of the two regions. */}
        <Announcer scope="dialog" />
      </dialog>
    </>
  );
}
