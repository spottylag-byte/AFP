const STYLES = {
  verified: "bg-pitch text-chalk",
  pending: "bg-accent text-ink",
  unverified: "bg-zinc-500/15 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
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
