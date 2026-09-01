const STYLES = {
  verified: "bg-primary/10 text-primary dark:bg-primary/20",
  pending: "bg-accent/10 text-accent dark:bg-accent/20",
  unverified: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
} as const;

export default function Badge({
  kind,
  children,
}: {
  kind: keyof typeof STYLES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[kind]}`}
    >
      {children}
    </span>
  );
}
