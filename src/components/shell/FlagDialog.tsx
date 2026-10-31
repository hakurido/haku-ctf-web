"use client";

import React, { useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import { FlagForm } from "../flag/FlagForm";

export function FlagDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openDialog = () => {
    setIsOpen(true);
    dialogRef.current?.showModal();
  };

  const closeDialog = () => {
    dialogRef.current?.close();
    setIsOpen(false);
  };

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        onClick={openDialog}
        className="font-medium"
      >
        Submit flag
      </Button>

      <dialog
        ref={dialogRef}
        onClose={() => setIsOpen(false)}
        className="w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-5 text-fg shadow-dialog backdrop:bg-backdrop motion-safe:animate-dialog-in focus-visible:outline-none"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
          <h2 className="text-title text-fg font-semibold">Submit a flag</h2>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close"
            className="size-8 inline-flex items-center justify-center rounded-md text-fg-secondary hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {isOpen && <FlagForm variant="dialog" onSuccess={closeDialog} />}
      </dialog>
    </>
  );
}
