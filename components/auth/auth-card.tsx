type AuthCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/** Auth screens sit directly on the dotted paper; a solid card holds only the form itself. */
export function AuthCard({ eyebrow, title, description, children, footer }: AuthCardProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-6 rounded-xl border bg-card p-6 shadow-[0_1px_0_hsl(var(--border)),0_12px_32px_-12px_hsl(var(--foreground)/0.12)] sm:p-8">
        {children}
      </div>
      {footer && <div className="text-center text-lg">{footer}</div>}
    </div>
  );
}
