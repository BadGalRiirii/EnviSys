/** Live discussion thread for a thesis group.
 * Connects over WebSocket for instant delivery; history and posting fall
 * back to REST, so the thread works even if the socket drops. */
import { SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { collaborationApi, wsUrl } from "../api/services";
import { useAuth } from "../context/AuthContext";
import type { Comment } from "../types";

export default function Discussion({ groupId }: { groupId: number }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    collaborationApi
      .comments(groupId)
      .then((r) => setMessages(r.data.results))
      .catch(() => {});

    const ws = new WebSocket(wsUrl(`groups/${groupId}`));
    ws.onopen = () => setLive(true);
    ws.onclose = () => setLive(false);
    ws.onmessage = (event) => {
      const comment = JSON.parse(event.data) as Comment;
      setMessages((prev) =>
        prev.some((m) => m.id === comment.id) ? prev : [...prev, comment],
      );
    };
    socket.current = ws;
    return () => ws.close();
  }, [groupId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ body }));
    } else {
      const { data } = await collaborationApi.post(groupId, body);
      setMessages((prev) => [...prev, data]);
    }
  };

  return (
    <section className="card" aria-labelledby="discussion-h">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="discussion-h" className="font-display text-lg">Discussion</h2>
        <span className={`flex items-center gap-1.5 text-xs ${live ? "text-fern" : "text-ink/40"}`}>
          <span aria-hidden className={`h-2 w-2 rounded-full ${live ? "bg-fern" : "bg-line"}`} />
          {live ? "Live" : "Reconnecting…"}
        </span>
      </div>
      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-ink/50">
            No messages yet. Discuss revisions, deadlines, and defense prep here —
            everyone in the group, your adviser, and approved panel members can read it.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.author.id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  mine ? "bg-fern text-white" : "border border-line bg-moss"
                }`}
              >
                {!mine && (
                  <p className="mb-0.5 text-xs font-semibold text-fern">{m.author.full_name}</p>
                )}
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-ink/40"}`}>
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          aria-label="Message"
          className="input"
          placeholder="Write a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn-primary shrink-0" aria-label="Send message">
          <SendHorizontal size={16} />
        </button>
      </form>
    </section>
  );
}
