/**
 * Group detail: the workflow hub of EnviSys.
 * - Editable thesis title (Objective 5)
 * - Dynamic membership (Objective 4)
 * - Adviser selection with specialization + workload (Objectives 6–8)
 * - Topic proposal → adviser approval (Objective 14)
 * - Panel nomination → admin validation (Objective 15)
 * - Stage readiness + advancement (Objectives 14 & 17)
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { apiError } from "../api/client";
import { authApi, googleApi, groupsApi, thesesApi } from "../api/services";
import ActionDialog, { type ActionDialogRequest } from "../components/ActionDialog";
import Discussion from "../components/Discussion";
import Milestones from "../components/Milestones";
import StageRail from "../components/StageRail";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import type { Adviser, ThesisGroup, ThesisTopic, User } from "../types";

export default function GroupDetail() {
  const { id } = useParams();
  const groupId = Number(id);
  const { user } = useAuth();
  const [group, setGroup] = useState<ThesisGroup | null>(null);
  const [topics, setTopics] = useState<ThesisTopic[]>([]);
  const [advisers, setAdvisers] = useState<Adviser[]>([]);
  const [students, setStudents] = useState<User[]>([]);

  const [titleDraft, setTitleDraft] = useState("");
  const [topicForm, setTopicForm] = useState({ title: "", abstract: "" });
  const [selectedAdviser, setSelectedAdviser] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedPanelist, setSelectedPanelist] = useState("");
  const [dialog, setDialog] = useState<ActionDialogRequest | null>(null);

  const isAdmin = user?.role === "ADMIN";
  const isAdviser = user?.id === group?.adviser?.id;
  const isMember = group?.members.some((m) => m.student.id === user?.id) ?? false;
  const hasPendingTopic = topics.some((t) => t.status === "PENDING");
  const latestTopicRejected = topics[0]?.status === "REJECTED";

  const load = useCallback(async () => {
    const { data } = await groupsApi.get(groupId);
    setGroup(data);
    setTitleDraft(data.thesis_title);
    const t = await thesesApi.topics({ group: String(groupId) });
    setTopics(t.data.results);
  }, [groupId]);

  useEffect(() => {
    load().catch((err) => toast.error(apiError(err)));
    authApi.advisers({ group: groupId }).then((r) => setAdvisers(r.data.results)).catch(() => {});
    if (user?.role === "ADMIN") {
      authApi.users({ role: "STUDENT" }).then((r) => setStudents(r.data.results)).catch(() => {});
    }
  }, [load, user?.role, groupId]);

  const bestMatch = (candidates: Adviser[]): number | null =>
    candidates.reduce<number | null>((best, a) => {
      if (!a.match_score) return best;
      const bestScore = best ? candidates.find((x) => x.id === best)?.match_score ?? 0 : 0;
      return a.match_score > bestScore ? a.id : best;
    }, null);
  const bestMatchId = bestMatch(advisers);
  const panelCandidates = advisers.filter((a) => a.id !== group?.adviser?.id);
  const bestPanelMatchId = bestMatch(panelCandidates);

  const run = (action: () => Promise<unknown>, success: string) => async () => {
    try {
      await action();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const saveTitle = run(
    () => groupsApi.update(groupId, { thesis_title: titleDraft }),
    "Thesis title updated.",
  );

  const submitTopic = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await thesesApi.submitTopic({ group: groupId, ...topicForm });
      toast.success("Topic submitted for adviser review.");
      setTopicForm({ title: "", abstract: "" });
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const createDoc = async () => {
    try {
      const { data } = await googleApi.createDoc(groupId, group?.thesis_title || group?.name || "Thesis document");
      window.open(data.drive_link, "_blank");
      toast.success("Google Doc created in your group's Drive folder.");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  if (!group) return <p className="text-sm text-ink/50">Loading group…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{group.name}</h1>
          <div className="mt-2">
            <StageRail stage={group.stage} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={group.status} />
          {group.ready_for_defense && <StatusBadge status="APPROVED" />}
        </div>
      </div>

      {group.status === "REJECTED" && (
        <div className="rounded-md border border-rust/30 bg-rust/5 px-4 py-3 text-sm text-rust">
          This group was not approved by the chairperson. Contact your department for next steps.
        </div>
      )}

      {/* Thesis title — editable per Objective 5 */}
      <section className="card">
        <label className="label" htmlFor="thesis_title">Thesis title</label>
        <div className="flex gap-2">
          <input
            id="thesis_title"
            className="input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            placeholder="Working thesis title"
            disabled={!isMember && !isAdmin}
          />
          {(isMember || isAdmin) && (
            <button className="btn-ghost shrink-0" onClick={saveTitle}>Save title</button>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Members */}
        <section className="card" aria-labelledby="members-h">
          <h2 id="members-h" className="mb-3 font-display text-lg">Members</h2>
          <ul className="space-y-2">
            {group.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <span>
                  {m.student.full_name}
                  {m.member_role === "LEADER" && (
                    <span className="ml-2 text-xs text-fern">Leader</span>
                  )}
                </span>
                {(isMember || isAdmin) && (
                  <button
                    className="text-xs text-rust hover:underline"
                    onClick={run(() => groupsApi.removeMember(groupId, m.id), "Member removed.")}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isAdmin && students.length > 0 && (
            <div className="mt-3 flex gap-2">
              <select
                aria-label="Add student"
                className="input"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
              >
                <option value="">Add a student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.student_id})
                  </option>
                ))}
              </select>
              <button
                className="btn-ghost shrink-0"
                disabled={!selectedStudent}
                onClick={run(
                  () => groupsApi.addMember(groupId, Number(selectedStudent)),
                  "Member added.",
                )}
              >
                Add
              </button>
            </div>
          )}
        </section>

        {/* Adviser — details, specialization, workload */}
        <section className="card" aria-labelledby="adviser-h">
          <h2 id="adviser-h" className="mb-3 font-display text-lg">Adviser</h2>
          {group.adviser ? (
            <p className="text-sm">
              <span className="font-medium">{group.adviser.full_name}</span>
              <span className="block text-ink/60">{group.adviser.specialization}</span>
            </p>
          ) : (
            <p className="text-sm text-ink/50">No adviser assigned yet.</p>
          )}
          {(isMember || isAdmin) && (
            <div className="mt-3 flex gap-2">
              <select
                aria-label="Select adviser"
                className="input"
                value={selectedAdviser}
                onChange={(e) => setSelectedAdviser(e.target.value)}
              >
                <option value="">Select a verified adviser…</option>
                {advisers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} — {a.specialization || "General"} ({a.active_advisees} active
                    group{a.active_advisees === 1 ? "" : "s"}){a.id === bestMatchId ? " ★ best match" : ""}
                  </option>
                ))}
              </select>
              <button
                className="btn-ghost shrink-0"
                disabled={!selectedAdviser}
                onClick={run(
                  () => groupsApi.assignAdviser(groupId, Number(selectedAdviser)),
                  "Adviser assigned.",
                )}
              >
                Assign
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Panel nomination → admin validation */}
      <section className="card" aria-labelledby="panel-h">
        <h2 id="panel-h" className="mb-3 font-display text-lg">Panel members</h2>
        {group.panel_assignments.length === 0 ? (
          <p className="text-sm text-ink/50">No panel members nominated yet.</p>
        ) : (
          <ul className="space-y-2">
            {group.panel_assignments.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span>
                  {p.faculty.full_name}
                  <span className="ml-2 text-ink/50">{p.faculty.specialization}</span>
                </span>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
        {(isAdviser || isAdmin) && (
          <div className="mt-3 flex gap-2">
            <select
              aria-label="Nominate panel member"
              className="input"
              value={selectedPanelist}
              onChange={(e) => setSelectedPanelist(e.target.value)}
            >
              <option value="">Nominate a faculty member…</option>
              {panelCandidates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name} — {a.specialization || "General"}
                  {a.id === bestPanelMatchId ? " ★ best match" : ""}
                </option>
              ))}
            </select>
            <button
              className="btn-ghost shrink-0"
              disabled={!selectedPanelist}
              onClick={run(
                () => groupsApi.nominatePanel(groupId, Number(selectedPanelist)),
                "Panel member nominated. Awaiting chairperson approval.",
              )}
            >
              Nominate
            </button>
          </div>
        )}
      </section>

      {/* Topics: proposal → adviser decision */}
      <section className="card" aria-labelledby="topics-h">
        <h2 id="topics-h" className="mb-3 font-display text-lg">Thesis topics</h2>
        {topics.length === 0 ? (
          <p className="text-sm text-ink/50">No topics submitted yet.</p>
        ) : (
          <ul className="space-y-3">
            {topics.map((t) => (
              <li key={t.id} className="rounded-md border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    {t.abstract && <p className="mt-1 text-xs text-ink/60">{t.abstract}</p>}
                    {t.feedback && (
                      <p className="mt-1 text-xs text-amber">Feedback: {t.feedback}</p>
                    )}
                  </div>
                  <StatusBadge status={t.status} />
                </div>
                {(isAdviser || isAdmin) && t.status === "PENDING" && (
                  <div className="mt-2 flex gap-2">
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
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {isMember && hasPendingTopic && (
          <p className="mt-4 border-t border-line pt-4 text-sm text-ink/50">
            A topic is already pending review — check back once your adviser decides.
          </p>
        )}
        {isMember && !hasPendingTopic && (
          <form onSubmit={submitTopic} className="mt-4 space-y-2 border-t border-line pt-4">
            <label className="label" htmlFor="topic_title">
              {latestTopicRejected ? "Submit a revised topic" : "Propose a topic"}
            </label>
            <input
              id="topic_title"
              className="input"
              placeholder="Topic title"
              value={topicForm.title}
              onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
              required
            />
            <textarea
              aria-label="Topic abstract"
              className="input"
              rows={3}
              placeholder="Short abstract"
              value={topicForm.abstract}
              onChange={(e) => setTopicForm({ ...topicForm, abstract: e.target.value })}
            />
            <button className="btn-primary">
              {latestTopicRejected ? "Submit revised topic" : "Submit topic"}
            </button>
          </form>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Discussion groupId={groupId} />
        <Milestones groupId={groupId} stage={group.stage} />
      </div>

      {/* Workflow actions */}
      <section className="card" aria-labelledby="actions-h">
        <h2 id="actions-h" className="mb-3 font-display text-lg">Workflow</h2>
        <div className="flex flex-wrap gap-2">
          {group.drive_folder_link && (
            <a
              href={group.drive_folder_link}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              Open Drive folder
            </a>
          )}
          {(isMember || isAdviser || isAdmin) && (
            <button className="btn-ghost" onClick={createDoc}>
              Create Google Doc
            </button>
          )}
          {(isMember || isAdviser) && !group.ready_for_defense && (
            <button
              className="btn-primary"
              onClick={run(
                () => groupsApi.markReady(groupId),
                `Marked ready for the ${group.stage.toLowerCase()} defense.`,
              )}
            >
              Mark ready for {group.stage.toLowerCase()} defense
            </button>
          )}
          {isAdmin && group.status === "PENDING" && (
            <>
              <button
                className="btn-primary"
                onClick={run(() => groupsApi.approve(groupId), "Group approved.")}
              >
                Approve group
              </button>
              <button
                className="btn-danger"
                onClick={run(() => groupsApi.reject(groupId), "Group rejected.")}
              >
                Reject group
              </button>
            </>
          )}
          {isAdmin && group.stage !== "FINAL" && (
            <button
              className="btn-ghost"
              onClick={run(() => groupsApi.advanceStage(groupId), "Stage advanced.")}
            >
              Advance to next stage
            </button>
          )}
          {isAdmin && !group.is_archived && (
            <button
              className="btn-ghost"
              onClick={run(() => groupsApi.archive(groupId), "Group archived.")}
            >
              Archive
            </button>
          )}
        </div>
      </section>
      <ActionDialog request={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
