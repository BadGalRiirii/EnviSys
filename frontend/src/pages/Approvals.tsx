/** Unified approvals inbox for Faculty and the Chairperson — everything
 * awaiting a decision from the current user, in one place, instead of
 * scattered across Documents/Schedules/GroupDetail. */
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { apiError } from "../api/client";
import { documentsApi, groupsApi, schedulesApi, thesesApi } from "../api/services";
import ActionDialog, { type ActionDialogRequest } from "../components/ActionDialog";
import { useAuth } from "../context/AuthContext";
import type { DefenseSchedule, PanelAssignment, ThesisDocument, ThesisGroup, ThesisTopic } from "../types";

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

export default function Approvals() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [topics, setTopics] = useState<ThesisTopic[]>([]);
  const [docs, setDocs] = useState<ThesisDocument[]>([]);
  const [toEvaluate, setToEvaluate] = useState<DefenseSchedule[]>([]);
  const [groupsPending, setGroupsPending] = useState<ThesisGroup[]>([]);
  const [nominations, setNominations] = useState<PanelAssignment[]>([]);
  const [schedulesPending, setSchedulesPending] = useState<DefenseSchedule[]>([]);
  const [resultsPending, setResultsPending] = useState<DefenseSchedule[]>([]);
  const [dialog, setDialog] = useState<ActionDialogRequest | null>(null);

  const load = async () => {
    const [t, d, approved] = await Promise.all([
      thesesApi.topics({ status: "PENDING" }),
      documentsApi.list({ status: "PENDING" }),
      schedulesApi.list({ status: "APPROVED" }),
    ]);
    setTopics(t.data.results);
    setDocs(d.data.results);
    setToEvaluate(
      approved.data.results.filter((s) => !s.evaluations.some((e) => e.evaluator.id === user?.id)),
    );

    if (isAdmin) {
      const [g, n, proposed, forResults] = await Promise.all([
        groupsApi.list({ status: "PENDING", is_archived: "false" }),
        groupsApi.panelAssignments({ status: "NOMINATED" }),
        schedulesApi.list({ status: "PROPOSED" }),
        schedulesApi.list({ status: "APPROVED" }),
      ]);
      setGroupsPending(g.data.results);
      setNominations(n.data.results);
      setSchedulesPending(proposed.data.results);
      setResultsPending(forResults.data.results.filter((s) => !s.result));
    }
  };

  useEffect(() => {
    load().catch((err) => toast.error(apiError(err)));
    // Re-run when the role-derived scope changes; `load` itself is stable per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const run = (action: () => Promise<unknown>, success: string) => async () => {
    try {
      await action();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const total =
    topics.length + docs.length + toEvaluate.length +
    (isAdmin ? groupsPending.length + nominations.length + schedulesPending.length + resultsPending.length : 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Approvals</h1>
        <p className="mt-1 text-sm text-ink/60">
          {total === 0
            ? "You're all caught up — nothing needs your decision right now."
            : `${total} item${total === 1 ? "" : "s"} awaiting your decision.`}
        </p>
      </div>

      {topics.length > 0 && (
        <Section title="Topics awaiting your review">
          {topics.map((t) => (
            <Row key={t.id} to={`/groups/${t.group}`} label={t.title} sub={t.group_name}>
              <button
                className="btn-primary px-3 py-1 text-xs"
                onClick={run(() => thesesApi.approveTopic(t.id), "Topic approved.")}
              >
                Approve
              </button>
              <button
                className="btn-danger px-3 py-1 text-xs"
                onClick={() =>
                  setDialog({
                    title: `Reject topic — ${t.title}`,
                    confirmLabel: "Reject topic",
                    onConfirm: (_v, feedback) =>
                      run(() => thesesApi.rejectTopic(t.id, feedback), "Topic rejected.")(),
                  })
                }
              >
                Reject
              </button>
            </Row>
          ))}
        </Section>
      )}

      {docs.length > 0 && (
        <Section title="Documents awaiting your review">
          {docs.map((d) => (
            <Row key={d.id} to={`/groups/${d.group}`} label={`${d.title} v${d.version}`} sub={d.group_name}>
              <button
                className="btn-primary px-3 py-1 text-xs"
                onClick={run(() => documentsApi.approve(d.id), "Document approved.")}
              >
                Approve
              </button>
              <button
                className="btn-ghost px-3 py-1 text-xs"
                onClick={() =>
                  setDialog({
                    title: `Request revision — ${d.title}`,
                    confirmLabel: "Request revision",
                    onConfirm: (_v, feedback) =>
                      run(() => documentsApi.requestRevision(d.id, feedback), "Revision requested.")(),
                  })
                }
              >
                Request revision
              </button>
              <button
                className="btn-danger px-3 py-1 text-xs"
                onClick={() =>
                  setDialog({
                    title: `Reject document — ${d.title}`,
                    confirmLabel: "Reject document",
                    onConfirm: (_v, feedback) =>
                      run(() => documentsApi.reject(d.id, feedback), "Document rejected.")(),
                  })
                }
              >
                Reject
              </button>
            </Row>
          ))}
        </Section>
      )}

      {toEvaluate.length > 0 && (
        <Section title="Defenses awaiting your evaluation">
          {toEvaluate.map((s) => (
            <Row
              key={s.id}
              to={`/groups/${s.group}`}
              label={`${s.group_name} — ${s.stage.toLowerCase()} defense`}
              sub={`${s.date} at ${s.time.slice(0, 5)} · ${s.location} · ${s.voters_evaluated}/${s.voters_total} evaluated`}
            >
              <button
                className="btn-primary px-3 py-1 text-xs"
                onClick={() =>
                  setDialog({
                    title: `Evaluate ${s.group_name} — ${s.stage.toLowerCase()} defense`,
                    confirmLabel: "Record evaluation",
                    verdicts: verdictsFor(s.suggested_verdict),
                    feedbackLabel: "Comments for the group",
                    onConfirm: (verdict, comments) =>
                      run(() => schedulesApi.evaluate(s.id, verdict, comments), "Evaluation recorded.")(),
                  })
                }
              >
                Evaluate
              </button>
            </Row>
          ))}
        </Section>
      )}

      {isAdmin && groupsPending.length > 0 && (
        <Section title="Groups awaiting approval">
          {groupsPending.map((g) => (
            <Row key={g.id} to={`/groups/${g.id}`} label={g.name} sub={g.thesis_title || "No thesis title yet"}>
              <button
                className="btn-primary px-3 py-1 text-xs"
                onClick={run(() => groupsApi.approve(g.id), "Group approved.")}
              >
                Approve
              </button>
              <button
                className="btn-danger px-3 py-1 text-xs"
                onClick={run(() => groupsApi.reject(g.id), "Group rejected.")}
              >
                Reject
              </button>
            </Row>
          ))}
        </Section>
      )}

      {isAdmin && nominations.length > 0 && (
        <Section title="Panel nominations">
          {nominations.map((n) => (
            <Row key={n.id} to={`/groups/${n.group}`} label={n.faculty.full_name} sub={n.group_name}>
              <button
                className="btn-primary px-3 py-1 text-xs"
                onClick={run(() => groupsApi.approvePanel(n.id), "Panel member approved.")}
              >
                Approve
              </button>
              <button
                className="btn-danger px-3 py-1 text-xs"
                onClick={run(() => groupsApi.rejectPanel(n.id), "Nomination rejected.")}
              >
                Reject
              </button>
            </Row>
          ))}
        </Section>
      )}

      {isAdmin && schedulesPending.length > 0 && (
        <Section title="Defense schedules awaiting approval">
          {schedulesPending.map((s) => (
            <Row
              key={s.id}
              to={`/groups/${s.group}`}
              label={`${s.group_name} — ${s.stage.toLowerCase()} defense`}
              sub={`${s.date} at ${s.time.slice(0, 5)} · ${s.location}`}
            >
              <button
                className="btn-primary px-3 py-1 text-xs"
                onClick={run(() => schedulesApi.approve(s.id), "Schedule approved.")}
              >
                Approve
              </button>
              <button
                className="btn-danger px-3 py-1 text-xs"
                onClick={() =>
                  setDialog({
                    title: `Reject schedule — ${s.group_name}`,
                    confirmLabel: "Reject schedule",
                    feedbackLabel: "Reason (optional)",
                    onConfirm: (_v, remarks) =>
                      run(() => schedulesApi.reject(s.id, remarks), "Schedule rejected.")(),
                  })
                }
              >
                Reject
              </button>
            </Row>
          ))}
        </Section>
      )}

      {isAdmin && resultsPending.length > 0 && (
        <Section title="Defense results to record">
          {resultsPending.map((s) => (
            <Row
              key={s.id}
              to={`/groups/${s.group}`}
              label={`${s.group_name} — ${s.stage.toLowerCase()} defense`}
              sub={
                `${s.date} at ${s.time.slice(0, 5)} · ${s.voters_evaluated}/${s.voters_total} evaluated`
                + (s.suggested_verdict
                    ? ` · panel leans: ${s.suggested_verdict.replace(/_/g, " ").toLowerCase()}`
                    : "")
              }
            >
              <button
                className="btn-primary px-3 py-1 text-xs"
                onClick={() =>
                  setDialog({
                    title: `Final result — ${s.group_name}`,
                    confirmLabel: "Record result",
                    verdicts: verdictsFor(s.suggested_verdict),
                    feedbackLabel: "Remarks",
                    onConfirm: (verdict, remarks) =>
                      run(() => schedulesApi.recordResult(s.id, verdict, remarks), "Result recorded.")(),
                  })
                }
              >
                Record result
              </button>
            </Row>
          ))}
        </Section>
      )}

      <ActionDialog request={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2 className="mb-3 font-display text-lg">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function Row({
  to, label, sub, children,
}: {
  to: string;
  label: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 text-sm last:border-0 last:pb-0">
      <Link to={to} className="hover:underline">
        <span className="font-medium">{label}</span>
        {sub && <span className="ml-2 text-ink/50">{sub}</span>}
      </Link>
      <span className="flex gap-2">{children}</span>
    </li>
  );
}
