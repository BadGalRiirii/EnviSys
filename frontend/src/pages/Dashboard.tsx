/** Role-aware dashboard: each role sees its own workload at a glance. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { documentsApi, groupsApi, milestonesApi, reportsApi, schedulesApi } from "../api/services";
import StageRail from "../components/StageRail";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import type { DefenseSchedule, Milestone, ReportSummary, ThesisDocument, ThesisGroup } from "../types";

export default function Dashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ThesisGroup[]>([]);
  const [pendingDocs, setPendingDocs] = useState<ThesisDocument[]>([]);
  const [upcoming, setUpcoming] = useState<DefenseSchedule[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  useEffect(() => {
    reportsApi.summary().then((r) => setSummary(r.data)).catch(() => {});
    milestonesApi.list({ is_completed: "false" }).then((r) => setMilestones(r.data.results)).catch(() => {});
    groupsApi.list({ is_archived: "false" }).then((r) => setGroups(r.data.results)).catch(() => {});
    documentsApi.list({ status: "PENDING" }).then((r) => setPendingDocs(r.data.results)).catch(() => {});
    schedulesApi.list({ status: "APPROVED" }).then((r) => setUpcoming(r.data.results)).catch(() => {});
  }, []);

  const heading =
    user?.role === "ADMIN"
      ? "Department overview"
      : user?.role === "FACULTY"
        ? "Your advisees and panels"
        : "Your thesis";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">{heading}</h1>
        <p className="mt-1 text-sm text-ink/60">
          Track progress across the Concept, Proposal, and Final Defense stages.
        </p>
      </div>

      {summary && (
        <section aria-label="Progress summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Active groups" value={summary.groups_total} />
          <SummaryCard label="Ready for defense" value={summary.groups_ready_for_defense} />
          <SummaryCard
            label="Pending reviews"
            value={summary.pending_topics + summary.pending_documents}
            to={user?.role !== "STUDENT" ? "/approvals" : undefined}
          />
          <SummaryCard
            label="Overdue milestones"
            value={summary.overdue_milestones}
            alert={summary.overdue_milestones > 0}
          />
          {user?.role === "ADMIN" && (
            <>
              <SummaryCard label="Groups awaiting approval" value={summary.pending_group_approvals ?? 0} to="/approvals" />
              <SummaryCard label="Panel nominations" value={summary.pending_panel_nominations ?? 0} to="/approvals" />
              <SummaryCard label="Schedules to approve" value={summary.pending_schedules ?? 0} to="/approvals" />
              <SummaryCard label="Results to record" value={summary.pending_results ?? 0} to="/approvals" />
              <SummaryCard label="Defenses in 14 days" value={summary.upcoming_defenses} />
              <SummaryCard label="Archived theses" value={summary.archived_theses ?? 0} />
            </>
          )}
        </section>
      )}

      <section aria-labelledby="groups-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="groups-heading" className="font-display text-lg">Thesis groups</h2>
          <Link to="/groups" className="text-sm text-fern hover:underline">View all</Link>
        </div>
        {groups.length === 0 ? (
          <div className="card text-sm text-ink/60">
            {user?.role === "STUDENT"
              ? "You're not in a thesis group yet. Create one to get started."
              : "No thesis groups to show yet."}
            {user?.role === "STUDENT" && (
              <Link to="/groups" className="btn-primary mt-3">Create your group</Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.slice(0, 4).map((g) => (
              <Link key={g.id} to={`/groups/${g.id}`} className="card block hover:border-fern">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-ink/60">
                      {g.thesis_title || "No thesis title yet"}
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
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="mb-3 font-display text-lg">
            {user?.role === "STUDENT" ? "Documents awaiting review" : "Documents to review"}
          </h2>
          {pendingDocs.length === 0 ? (
            <p className="text-sm text-ink/50">Nothing pending right now.</p>
          ) : (
            <ul className="space-y-2">
              {pendingDocs.slice(0, 5).map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="line-clamp-1">
                    {d.title} <span className="text-ink/40">v{d.version} · {d.group_name}</span>
                  </span>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="mb-3 font-display text-lg">Upcoming defenses</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink/50">No approved defense schedules yet.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.slice(0, 5).map((s) => (
                <li key={s.id} className="text-sm">
                  <span className="font-medium">{s.group_name}</span>{" "}
                  <span className="text-ink/60">
                    — {s.stage.toLowerCase()} defense, {s.date} at {s.time.slice(0, 5)}, {s.location}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {milestones.length > 0 && (
        <section className="card" aria-labelledby="milestones-heading">
          <h2 id="milestones-heading" className="mb-3 font-display text-lg">Upcoming milestones</h2>
          <ul className="space-y-2">
            {milestones.slice(0, 6).map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <span>
                  {m.title} <span className="text-ink/40">· {m.group_name}</span>
                </span>
                <span className={`text-xs ${m.is_overdue ? "font-semibold text-rust" : "text-ink/50"}`}>
                  {m.is_overdue ? "Overdue · " : "Due "}
                  {m.due_date}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  label, value, alert, to,
}: { label: string; value: number; alert?: boolean; to?: string }) {
  const content = (
    <>
      <p className={`font-display text-2xl font-semibold ${alert ? "text-rust" : ""}`}>{value}</p>
      <p className="mt-0.5 text-xs text-ink/60">{label}</p>
    </>
  );
  return to ? (
    <Link to={to} className="card block py-4 hover:border-fern">{content}</Link>
  ) : (
    <div className="card py-4">{content}</div>
  );
}
