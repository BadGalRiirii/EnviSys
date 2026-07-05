/** Reusable dialog for decisions that need feedback text and/or a verdict —
 * replaces browser prompt() for a seamless review experience. */
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface ActionDialogRequest {
  title: string;
  confirmLabel: string;
  verdicts?: readonly (readonly [string, string])[];
  feedbackLabel?: string;
  onConfirm: (verdict: string, feedback: string) => void;
}

export default function ActionDialog({
  request,
  onClose,
}: {
  request: ActionDialogRequest | null;
  onClose: () => void;
}) {
  const [verdict, setVerdict] = useState("");
  const [feedback, setFeedback] = useState("");
  const firstField = useRef<HTMLSelectElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (request) {
      setVerdict(request.verdicts?.[0]?.[0] ?? "");
      setFeedback("");
      setTimeout(() => firstField.current?.focus(), 0);
    }
  }, [request]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={request.title}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg">{request.title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-ink/50 hover:bg-moss">
            <X size={16} />
          </button>
        </div>
        {request.verdicts && (
          <div className="mb-3">
            <label className="label" htmlFor="dialog_verdict">Verdict</label>
            <select
              id="dialog_verdict"
              ref={firstField as React.RefObject<HTMLSelectElement>}
              className="input"
              value={verdict}
              onChange={(e) => setVerdict(e.target.value)}
            >
              {request.verdicts.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="mb-4">
          <label className="label" htmlFor="dialog_feedback">
            {request.feedbackLabel ?? "Feedback for the group (optional)"}
          </label>
          <textarea
            id="dialog_feedback"
            ref={request.verdicts ? undefined : (firstField as React.RefObject<HTMLTextAreaElement>)}
            className="input"
            rows={3}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => {
              request.onConfirm(verdict, feedback);
              onClose();
            }}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
