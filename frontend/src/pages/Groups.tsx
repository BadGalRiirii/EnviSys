/** Thesis group list + creation (dynamic membership, Objective 4). */
import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { apiError } from "../api/client";
import { groupsApi } from "../api/services";
import StageRail from "../components/StageRail";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import type { ThesisGroup } from "../types";

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ThesisGroup[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");

  const load = () => groupsApi.list({ is_archived: "false" }).then((r) => setGroups(r.data.results));
  useEffect(() => {
    load().catch(() => {});
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await groupsApi.create({ name, thesis_title: title });
      toast.success("Group created. It's now pending chairperson approval.");
      setCreating(false);
      setName("");
      setTitle("");
      load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Thesis groups</h1>
        {user?.role !== "FACULTY" && (
          <button className="btn-primary" onClick={() => setCreating(!creating)}>
            <Plus size={16} /> New group
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={create} className="card space-y-3">
          <div>
            <label className="label" htmlFor="group_name">Group name</label>
            <input id="group_name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="working_title">Working thesis title (optional, editable later)</label>
            <input id="working_title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary">Create group</button>
            <button type="button" className="btn-ghost" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {groups.length === 0 && !creating ? (
        <div className="card text-sm text-ink/60">No thesis groups yet.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <Link key={g.id} to={`/groups/${g.id}`} className="card block hover:border-fern">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{g.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-sm text-ink/60">
                    {g.thesis_title || "No thesis title yet"}
                  </p>
                  <p className="mt-1 text-xs text-ink/50">
                    {g.members.length} member{g.members.length === 1 ? "" : "s"}
                    {g.adviser ? ` · Adviser: ${g.adviser.full_name}` : " · No adviser yet"}
                  </p>
                </div>
                <StatusBadge status={g.status} />
              </div>
              <div className="mt-4">
                <StageRail stage={g.stage} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
