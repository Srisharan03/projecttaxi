"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <section
        className={cn("modal-content glass-card", className)}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
