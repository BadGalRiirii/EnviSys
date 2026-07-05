/** Consistent status pill for Pending / Approved / Rejected / etc. */
const STYLES: Record<string, string> = {
  PENDING: "bg-amber/10 text-amber border-amber/30",
  PROPOSED: "bg-amber/10 text-amber border-amber/30",
  NOMINATED: "bg-amber/10 text-amber border-amber/30",
  REVISION: "bg-amber/10 text-amber border-amber/30",
  APPROVED: "bg-fern/10 text-fern border-fern/30",
  COMPLETED: "bg-fern/10 text-fern border-fern/30",
  PASSED: "bg-fern/10 text-fern border-fern/30",
  REJECTED: "bg-rust/10 text-rust border-rust/30",
  FAILED: "bg-rust/10 text-rust border-rust/30",
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? "bg-ink/5 text-ink/60 border-line";
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}
