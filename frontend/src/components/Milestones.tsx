/** Milestones with due dates per thesis group. */
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { apiError } from "../api/client";
import { milestonesApi } from "../api/services";
import type { Milestone, Stage } from "../types";

export default function Milestones({ groupId, stage }: { groupId: number; stage: Stage }) {
  const [items, setItems] = useState<Milestone[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", due_date: "" });

  const load = useCallback(
    () => milestonesApi.list({ group: String(groupId) }).then((r) => setItems(r.data.results)),
    [groupId],
  );
  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await milestonesApi.create({ group: groupId, stage, ...form });
      toast.success("Milestone added.");
      setAdding(false);
      setForm({ title: "", due_date: "" });
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const complete = async (id: number) => {
    try {
      await milestonesApi.complete(id);
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <section className="card" aria-labelledby="milestones-h">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="milestones-h" className="font-display text-lg">Milestones</h2>
        <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setAdding(!adding)}>
          <Plus size={14} /> Add milestone
        </button>
      </div>

      {adding && (
        <form onSubmit={add} className="mb-3 flex flex-wrap gap-2">
          <input
            aria-label="Milestone title"
            className="input flex-1"
            placeholder="e.g. Chapter 3 draft to adviser"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <input
            aria-label="Due date"
            type="date"
            className="input w-40"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            required
          />
          <button className="btn-primary shrink-0">Add</button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-ink/50">
          No milestones yet. Break the {stage.toLowerCase()} stage into dated targets —
          the system reminds everyone as deadlines approach.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <button
                className="flex items-center gap-2 text-left"
                onClick={() => !m.is_completed && complete(m.id)}
                aria-label={m.is_completed ? `${m.title} completed` : `Mark ${m.title} complete`}
                disabled={m.is_completed}
              >
                {m.is_completed ? (
                  <CheckCircle2 size={16} className="shrink-0 text-fern" aria-hidden />
                ) : (
                  <Circle size={16} className="shrink-0 text-ink/30" aria-hidden />
                )}
                <span className={m.is_completed ? "text-ink/40 line-through" : ""}>{m.title}</span>
              </button>
              <span className={`shrink-0 text-xs ${m.is_overdue ? "font-semibold text-rust" : "text-ink/50"}`}>
                {m.is_overdue ? "Overdue · " : "Due "}
                {m.due_date}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
