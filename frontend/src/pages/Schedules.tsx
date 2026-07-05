/** Defense schedule proposals, approval, evaluation, and results (Obj. 17). */
import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { apiError } from "../api/client";
import { groupsApi, schedulesApi } from "../api/services";
import ActionDialog, { type ActionDialogRequest } from "../components/ActionDialog";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import type { DefenseSchedule, ScheduleConflict, ScheduleSlot, ThesisGroup } from "../types";

const VERDICTS = [
  ["PASSED", "Passed"],
  ["PASSED_WITH_REVISIONS", "Passed with revisions"],
  ["REDEFENSE", "Re-defense"],
  ["FAILED", "Failed"],
] as const;

/** Move the panel's suggested verdict to the front so the dialog defaults to it. */
function verdictsFor(suggested: string | null): readonly (readonly [string, string])[] {
  if (!suggested) return VERDICTS;
  const match = VERDICTS.find(([value]) => value === suggested);
  if (!match) return VERDICTS;
  return [match, ...VERDICTS.filter(([value]) => value !== suggested)];
}

export default function Schedules() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<DefenseSchedule[]>([]);
  const [groups, setGroups] = useState<ThesisGroup[]>([]);
  const [proposing, setProposing] = useState(false);
  const [dialog, setDialog] = useState<ActionDialogRequest | null>(null);
  const [form, setForm] = useState({
    group: "",
    stage: "CONCEPT",
    date: "",
    time: "",
    duration_minutes: "60",
    location: "",
  });
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [suggestedSlots, setSuggestedSlots] = useState<ScheduleSlot[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const isFacultyOrAdmin = user?.role === "FACULTY" || user?.role === "ADMIN";
  const isAdmin = user?.role === "ADMIN";

  const load = () => schedulesApi.list().then((r) => setSchedules(r.data.results));
  useEffect(() => {
    load().catch(() => {});
    groupsApi.list().then((r) => setGroups(r.data.results)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!proposing || !form.group || !form.date || !form.time) {
      setConflicts([]);
      return;
    }
    const timer = setTimeout(() => {
      schedulesApi
        .checkConflicts({
          group: form.group, date: form.date, time: form.time,
          duration_minutes: form.duration_minutes, location: form.location,
        })
        .then((r) => setConflicts(r.data.conflicts))
        .catch(() => setConflicts([]));
    }, 400);
    return () => clearTimeout(timer);
  }, [proposing, form.group, form.date, form.time, form.duration_minutes, form.location]);

  const run = (action: () => Promise<unknown>, success: string) => async () => {
    try {
      await action();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const suggestTimes = async () => {
    if (!form.group) return;
    setSuggesting(true);
    try {
      const { data } = await schedulesApi.suggestSlots({
        group: form.group, duration_minutes: form.duration_minutes, location: form.location,
      });
      setSuggestedSlots(data.slots);
      if (data.slots.length === 0) toast.error("No open slots found in the next three weeks.");
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSuggesting(false);
    }
  };

  const propose = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await schedulesApi.propose({
        ...form,
        group: Number(form.group),
        duration_minutes: Number(form.duration_minutes),
      });
      toast.success("Schedule proposed. The chairperson will confirm it.");
      setProposing(false);
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const evaluate = (s: DefenseSchedule) =>
    setDialog({
      title: `Evaluate ${s.group_name} — ${s.stage.toLowerCase()} defense`,
      confirmLabel: "Record evaluation",
      verdicts: verdictsFor(s.suggested_verdict),
      feedbackLabel: "Comments for the group",
      onConfirm: (verdict, comments) =>
        run(() => schedulesApi.evaluate(s.id, verdict, comments), "Evaluation recorded.")(),
    });

  const recordResult = (s: DefenseSchedule) =>
    setDialog({
      title: `Final result — ${s.group_name}`,
      confirmLabel: "Record result",
      verdicts: verdictsFor(s.suggested_verdict),
      feedbackLabel: "Remarks",
      onConfirm: (verdict, remarks) =>
        run(() => schedulesApi.recordResult(s.id, verdict, remarks), "Result recorded.")(),
    });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Defense schedules</h1>
        {isFacultyOrAdmin && (
          <button className="btn-primary" onClick={() => setProposing(!proposing)}>
            <Plus size={16} /> Propose schedule
          </button>
        )}
      </div>

      {proposing && (
        <form onSubmit={propose} className="card grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sched_group">Group</label>
            <select
              id="sched_group"
              className="input"
              value={form.group}
              onChange={(e) => setForm({ ...form, group: e.target.value })}
              required
            >
              <option value="">Select a group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sched_stage">Stage</label>
            <select
              id="sched_stage"
              className="input"
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
            >
              <option value="CONCEPT">Concept</option>
              <option value="PROPOSAL">Proposal</option>
              <option value="FINAL">Final Defense</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sched_date">Date</label>
            <input id="sched_date" type="date" className="input" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <label className="label" htmlFor="sched_time">Time</label>
            <input id="sched_time" type="time" className="input" value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })} required />
          </div>
          <div>
            <label className="label" htmlFor="sched_duration">Duration (minutes)</label>
            <input id="sched_duration" type="number" min={15} step={15} className="input"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} required />
          </div>
          <div>
            <label className="label" htmlFor="sched_location">Location</label>
            <input id="sched_location" className="input" placeholder="e.g. CITC Conference Room"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })} required />
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              className="btn-ghost px-3 py-1 text-xs"
              disabled={!form.group || suggesting}
              onClick={suggestTimes}
            >
              {suggesting ? "Checking availability…" : "Suggest available times"}
            </button>
            {suggestedSlots.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestedSlots.map((slot) => (
                  <button
                    key={`${slot.date}-${slot.time}`}
                    type="button"
                    className="rounded-md border border-line px-2 py-1 text-xs hover:border-fern hover:text-fern"
                    onClick={() => setForm({ ...form, date: slot.date, time: slot.time })}
                  >
                    {slot.date} {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>
          {conflicts.length > 0 && (
            <div className="rounded-md border border-rust/30 bg-rust/5 px-3 py-2 text-xs text-rust sm:col-span-2">
              <p className="font-medium">This slot conflicts with a confirmed defense:</p>
              <ul className="mt-1 list-disc pl-4">
                {conflicts.map((c) => (
                  <li key={c.schedule_id}>{c.group_name} — {c.reason}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary" disabled={conflicts.length > 0}>Propose schedule</button>
            <button type="button" className="btn-ghost" onClick={() => setProposing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {schedules.length === 0 ? (
        <div className="card text-sm text-ink/60">No defense schedules yet.</div>
      ) : (
        <ul className="space-y-3">
          {schedules.map((s) => (
            <li key={s.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {s.group_name} — {s.stage.toLowerCase()} defense
                  </p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {s.date} at {s.time.slice(0, 5)} · {s.duration_minutes} min · {s.location}
                  </p>
                  {(s.status === "APPROVED" || s.status === "COMPLETED") && s.voters_total > 0 && (
                    <p className="mt-0.5 text-xs text-ink/50">
                      {s.voters_evaluated}/{s.voters_total} evaluated
                      {s.suggested_verdict && ` · suggested: ${s.suggested_verdict.replace(/_/g, " ").toLowerCase()}`}
                    </p>
                  )}
                  {s.remarks && <p className="mt-1 text-xs text-amber">{s.remarks}</p>}
                </div>
                <StatusBadge status={s.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {isAdmin && s.status === "PROPOSED" && (
                  <>
                    <button className="btn-primary px-3 py-1 text-xs"
                      onClick={run(() => schedulesApi.approve(s.id), "Schedule approved.")}>
                      Approve
                    </button>
                    <button className="btn-danger px-3 py-1 text-xs"
                      onClick={() =>
                        setDialog({
                          title: `Reject schedule — ${s.group_name}`,
                          confirmLabel: "Reject schedule",
                          feedbackLabel: "Reason (optional)",
                          onConfirm: (_v, remarks) =>
                            run(() => schedulesApi.reject(s.id, remarks), "Schedule rejected.")(),
                        })
                      }>
                      Reject
                    </button>
                  </>
                )}
                {isFacultyOrAdmin && s.status === "APPROVED" && (
                  <button className="btn-ghost px-3 py-1 text-xs" onClick={() => evaluate(s)}>
                    Record my evaluation
                  </button>
                )}
                {isAdmin && s.status === "APPROVED" && (
                  <button className="btn-ghost px-3 py-1 text-xs" onClick={() => recordResult(s)}>
                    Record final result
                  </button>
                )}
                {s.result && (
                  <button
                    className="btn-ghost px-3 py-1 text-xs"
                    onClick={() =>
                      schedulesApi.downloadCertificate(s.id).catch((err) => toast.error(apiError(err)))
                    }
                  >
                    Download certificate
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ActionDialog request={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
