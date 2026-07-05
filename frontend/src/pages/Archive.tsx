/** Digital archive repository: completed/archived theses with their
 * metadata, documents, and version histories (manuscript Scope item 6). */
import { Archive as ArchiveIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { documentsApi, groupsApi } from "../api/services";
import StatusBadge from "../components/StatusBadge";
import type { ThesisDocument, ThesisGroup } from "../types";

export default function Archive() {
  const [groups, setGroups] = useState<ThesisGroup[]>([]);
  const [docsByGroup, setDocsByGroup] = useState<Record<number, ThesisDocument[]>>({});
  const [openId, setOpenId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    groupsApi
      .list({ is_archived: "true" })
      .then((r) => setGroups(r.data.results))
      .catch(() => {});
  }, []);

  const toggle = async (id: number) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!docsByGroup[id]) {
      const { data } = await documentsApi.list({ group: String(id) });
      setDocsByGroup((prev) => ({ ...prev, [id]: data.results }));
    }
  };

  const filtered = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.thesis_title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Thesis archive</h1>
        <p className="mt-1 text-sm text-ink/60">
          The department's digital repository — completed theses with their approval
          records, version histories, and document links.
        </p>
      </div>
      <input
        aria-label="Search the archive"
        className="input max-w-md"
        placeholder="Search by group or thesis title…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 ? (
        <div className="card flex items-center gap-3 text-sm text-ink/60">
          <ArchiveIcon size={18} aria-hidden />
          No archived theses{search ? " match your search" : " yet"}.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((g) => (
            <li key={g.id} className="card">
              <button className="w-full text-left" onClick={() => toggle(g.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{g.thesis_title || g.name}</p>
                    <p className="mt-0.5 text-xs text-ink/50">
                      {g.name} · {g.members.map((m) => m.student.full_name).join(", ")}
                      {g.adviser ? ` · Adviser: ${g.adviser.full_name}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={g.stage} />
                </div>
              </button>
              {openId === g.id && (
                <div className="mt-3 border-t border-line pt-3">
                  {(docsByGroup[g.id] ?? []).length === 0 ? (
                    <p className="text-sm text-ink/50">No documents on record.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {docsByGroup[g.id].map((d) => (
                        <li key={d.id} className="flex items-center justify-between text-sm">
                          <a
                            href={d.drive_link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-fern hover:underline"
                          >
                            {d.title} <span className="text-ink/40">v{d.version}</span>
                          </a>
                          <StatusBadge status={d.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
