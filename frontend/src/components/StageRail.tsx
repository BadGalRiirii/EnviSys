/**
 * Signature element: the thesis stage rail.
 * Renders the Concept → Proposal → Final Defense progression that anchors
 * EnviSys's workflow tracking (manuscript Scope item 4).
 */
import type { Stage } from "../types";

const STAGES: { key: Stage; label: string }[] = [
  { key: "CONCEPT", label: "Concept" },
  { key: "PROPOSAL", label: "Proposal" },
  { key: "FINAL", label: "Final Defense" },
];

export default function StageRail({ stage }: { stage: Stage }) {
  const current = STAGES.findIndex((s) => s.key === stage);
  return (
    <ol className="flex items-center gap-0" aria-label="Thesis stage">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex items-center">
            {i > 0 && (
              <span
                aria-hidden
                className={`mx-1 h-px w-6 sm:w-10 ${done || active ? "bg-fern" : "bg-line"}`}
              />
            )}
            <span
              className={`flex items-center gap-1.5 text-xs ${
                active ? "font-semibold text-fern" : done ? "text-ink/70" : "text-ink/40"
              }`}
            >
              <span
                aria-hidden
                className={`inline-block h-2.5 w-2.5 rounded-full border ${
                  active
                    ? "border-fern bg-fern"
                    : done
                      ? "border-fern bg-fern/30"
                      : "border-line bg-white"
                }`}
              />
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
