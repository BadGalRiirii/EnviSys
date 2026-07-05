/** Document association, versioning, and review (Objectives 14 & 16). */
import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { apiError } from "../api/client";
import { documentsApi, groupsApi } from "../api/services";
import ActionDialog, { type ActionDialogRequest } from "../components/ActionDialog";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import type { ThesisDocument, ThesisGroup } from "../types";

const DOC_TYPES = [
  ["CONCEPT_PAPER", "Concept paper"],
  ["PROPOSAL_MANUSCRIPT", "Proposal manuscript"],
  ["FINAL_MANUSCRIPT", "Final manuscript"],
  ["REVISION", "Revision"],
  ["OTHER", "Other"],
] as const;

export default function Documents() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<ThesisDocument[]>([]);
  const [groups, setGroups] = useState<ThesisGroup[]>([]);
  const [linking, setLinking] = useState(false);
  const [dialog, setDialog] = useState<ActionDialogRequest | null>(null);
  const [form, setForm] = useState({
    group: "",
    title: "",
    doc_type: "CONCEPT_PAPER",
    stage: "CONCEPT",
    drive_link: "",
  });

  const canReview = user?.role === "FACULTY" || user?.role === "ADMIN";

  const load = () => documentsApi.list().then((r) => setDocs(r.data.results));
  useEffect(() => {
    load().catch(() => {});
    groupsApi.list().then((r) => setGroups(r.data.results)).catch(() => {});
  }, []);

  const run = (action: () => Promise<unknown>, success: string) => async () => {
    try {
      await action();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const link = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await documentsApi.link({ ...form, group: Number(form.group) });
      toast.success("Document linked and sent for review.");
      setLinking(false);
      setForm({ ...form, title: "", drive_link: "" });
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const withFeedback = (
    fn: (id: number, feedback: string) => Promise<unknown>,
    doc: ThesisDocument,
    title: string,
    confirmLabel: string,
    success: string,
  ) =>
    setDialog({
      title: `${title} — ${doc.title} v${doc.version}`,
      confirmLabel,
      onConfirm: (_v, feedback) => run(() => fn(doc.id, feedback), success)(),
    });

  const newVersion = (doc: ThesisDocument) =>
    setDialog({
      title: `Submit version ${doc.version + 1} of ${doc.title}`,
      confirmLabel: "Submit new version",
      feedbackLabel: "Google Docs / Drive link of the new version",
      onConfirm: (_v, link) => {
        if (!link.trim()) return;
        run(
          () =>
            documentsApi.newVersion(doc.id, {
              title: doc.title,
              drive_link: link.trim(),
              group: doc.group,
            }),
          `Version ${doc.version + 1} submitted.`,
        )();
      },
    });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Documents</h1>
        {user?.role !== "FACULTY" && (
          <button className="btn-primary" onClick={() => setLinking(!linking)}>
            <Plus size={16} /> Link a document
          </button>
        )}
      </div>
      <p className="-mt-3 text-sm text-ink/60">
        EnviSys links to your official documents on Google Drive and Google Docs — writing
        happens there, tracking happens here.
      </p>

      {linking && (
        <form onSubmit={link} className="card grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="doc_group">Group</label>
            <select
              id="doc_group"
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
            <label className="label" htmlFor="doc_title">Document title</label>
            <input
              id="doc_title"
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="doc_type">Type</label>
            <select
              id="doc_type"
              className="input"
              value={form.doc_type}
              onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
            >
              {DOC_TYPES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="doc_stage">Stage</label>
            <select
              id="doc_stage"
              className="input"
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
            >
              <option value="CONCEPT">Concept</option>
              <option value="PROPOSAL">Proposal</option>
              <option value="FINAL">Final Defense</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="doc_link">Google Docs / Drive link</label>
            <input
              id="doc_link"
              type="url"
              className="input"
              placeholder="https://docs.google.com/document/d/…"
              value={form.drive_link}
              onChange={(e) => setForm({ ...form, drive_link: e.target.value })}
              required
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary">Link document</button>
            <button type="button" className="btn-ghost" onClick={() => setLinking(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {docs.length === 0 ? (
        <div className="card text-sm text-ink/60">No documents linked yet.</div>
      ) : (
        <ul className="space-y-3">
          {docs.map((d) => (
            <li key={d.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {d.title} <span className="text-ink/40">v{d.version}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {d.group_name} · {d.stage.toLowerCase()} stage
                    {d.uploaded_by ? ` · linked by ${d.uploaded_by.full_name}` : ""}
                  </p>
                  {d.feedback && <p className="mt-1 text-xs text-amber">Feedback: {d.feedback}</p>}
                </div>
                <StatusBadge status={d.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={d.drive_link} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1 text-xs">
                  Open in Google Docs
                </a>
                {user?.role === "STUDENT" && (d.status === "REVISION" || d.status === "REJECTED") && (
                  <button className="btn-primary px-3 py-1 text-xs" onClick={() => newVersion(d)}>
                    Submit new version
                  </button>
                )}
                {canReview && d.status === "PENDING" && (
                  <>
                    <button
                      className="btn-primary px-3 py-1 text-xs"
                      onClick={() =>
                        withFeedback(documentsApi.approve, d, "Approve", "Approve document", "Document approved.")
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="btn-ghost px-3 py-1 text-xs"
                      onClick={() =>
                        withFeedback(
                          documentsApi.requestRevision, d, "Request revision",
                          "Request revision", "Revision requested.",
                        )
                      }
                    >
                      Request revision
                    </button>
                    <button
                      className="btn-danger px-3 py-1 text-xs"
                      onClick={() =>
                        withFeedback(documentsApi.reject, d, "Reject", "Reject document", "Document rejected.")
                      }
                    >
                      Reject
                    </button>
                  </>
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
