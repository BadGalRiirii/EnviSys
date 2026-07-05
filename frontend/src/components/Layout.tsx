/** App shell: sidebar navigation + top bar with notifications. */
import {
  Archive,
  CalendarDays,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Sprout,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { reportsApi } from "../api/services";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
    isActive ? "bg-fern text-white" : "text-ink/70 hover:bg-white hover:text-ink"
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [approvalsCount, setApprovalsCount] = useState(0);
  const canApprove = user?.role === "FACULTY" || user?.role === "ADMIN";

  useEffect(() => {
    if (!canApprove) return;
    reportsApi.summary().then(({ data }) => {
      const count =
        data.pending_topics + data.pending_documents +
        (user?.role === "ADMIN"
          ? (data.pending_group_approvals ?? 0) + (data.pending_panel_nominations ?? 0) +
            (data.pending_schedules ?? 0) + (data.pending_results ?? 0)
          : 0);
      setApprovalsCount(count);
    }).catch(() => {});
  }, [canApprove, user?.role]);

  const signOut = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-moss px-3 py-5 sm:flex">
        <div className="mb-6 flex items-center gap-2 px-3">
          <Sprout className="text-fern" size={22} aria-hidden />
          <span className="font-display text-lg font-semibold tracking-tight">EnviSys</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          <NavLink to="/" end className={linkClass}>
            <LayoutDashboard size={16} /> Dashboard
          </NavLink>
          {canApprove && (
            <NavLink to="/approvals" className={linkClass}>
              <ClipboardCheck size={16} />
              <span className="flex-1">Approvals</span>
              {approvalsCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rust px-1 text-[10px] font-semibold text-white">
                  {approvalsCount}
                </span>
              )}
            </NavLink>
          )}
          <NavLink to="/groups" className={linkClass}>
            <Users size={16} /> Thesis groups
          </NavLink>
          <NavLink to="/documents" className={linkClass}>
            <FileText size={16} /> Documents
          </NavLink>
          <NavLink to="/schedules" className={linkClass}>
            <CalendarDays size={16} /> Defense schedules
          </NavLink>
          <NavLink to="/archive" className={linkClass}>
            <Archive size={16} /> Archive
          </NavLink>
          {user?.role === "ADMIN" && (
            <NavLink to="/admin" className={linkClass}>
              <ShieldCheck size={16} /> Administration
            </NavLink>
          )}
          <NavLink to="/settings" className={linkClass}>
            <Settings size={16} /> Settings
          </NavLink>
        </nav>
        <button
          onClick={signOut}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink/70 hover:bg-white"
        >
          <LogOut size={16} /> Sign out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 sm:px-6">
          <div>
            <p className="text-sm font-medium">{user?.full_name}</p>
            <p className="text-xs text-ink/50">
              {user?.role === "ADMIN"
                ? "Department Chairperson"
                : user?.role === "FACULTY"
                  ? `Faculty — ${user.specialization || "Adviser / Panel"}`
                  : "Student"}
            </p>
          </div>
          <NotificationBell />
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
