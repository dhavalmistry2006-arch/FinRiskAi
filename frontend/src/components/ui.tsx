import { useUser } from "../session";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { AlertCircle, ArrowDownToLine, Loader2, X, Inbox } from "lucide-react";
export const cn = (...v: Parameters<typeof clsx>) => twMerge(clsx(...v));
const variants = cva("btn", {
  variants: {
    variant: {
      primary: "btn-primary",
      secondary: "btn-secondary",
      ghost: "btn-ghost",
      danger: "btn-danger",
    },
  },
  defaultVariants: { variant: "primary" },
});
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    asChild?: boolean;
  }
>(({ className, variant, asChild, ...props }, ref) => {
  const C = asChild ? Slot : "button";
  return (
    <C className={cn(variants({ variant }), className)} ref={ref} {...props} />
  );
});
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: string;
}) {
  const value = tone || String(children);
  return (
    <span
      className={`badge tone-${value.toLowerCase().replace(/[^a-z]/g, "")}`}
    >
      {children}
    </span>
  );
}
export function Loading() {
  return (
    <div role="status" className="loading-state">
      <Loader2 className="spin" size={22} />
      <span>Loading workspace data…</span>
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={24} />
      <div>
        <strong>Unable to load this workspace</strong>
        <p>
          {error instanceof Error
            ? error.message
            : "The service is unavailable. Please try again."}
        </p>
      </div>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Empty({
  title = "No records yet",
  description = "Create an application or initialize synthetic demo data to get started.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <Inbox size={34} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby={undefined}>
          <div className="dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">
          {eyebrow || "RISK INTELLIGENCE WORKSPACE"}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
export function Download({
  path,
  children = "Export data",
}: {
  path: string;
  children?: ReactNode;
}) {
  const user = useUser();
  if (user.role === "Read-Only Viewer") return null;
  return (
    <Button asChild variant="secondary">
      <a href={`/api/v1${path}`} download>
        <ArrowDownToLine size={15} />
        {children}
      </a>
    </Button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
