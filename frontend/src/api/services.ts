/**
 * Dedicated API service modules (manuscript §3.5.1: "HTTP Client and API
 * Services") covering auth, groups, theses, documents, schedules,
 * notifications, and the Google integration.
 */
import { client } from "./client";
import type {
  Adviser,
  DefenseSchedule,
  Notification,
  Paginated,
  PanelAssignment,
  ScheduleConflict,
  ScheduleSlot,
  ThesisDocument,
  ThesisGroup,
  ThesisTopic,
  User,
} from "../types";

// ---------------------------------------------------------------- auth
export const authApi = {
  login: (email: string, password: string) =>
    client.post<{ access: string; refresh: string; user: User }>("/auth/login/", { email, password }),
  register: (payload: Record<string, string>) => client.post("/auth/register/", payload),
  verifyEmail: (token: string) => client.post("/auth/verify-email/", { token }),
  requestPasswordReset: (email: string) => client.post("/auth/password-reset/", { email }),
  confirmPasswordReset: (token: string, password: string) =>
    client.post("/auth/password-reset/confirm/", { token, password }),
  me: () => client.get<User>("/auth/me/"),
  updateMe: (payload: Partial<User>) => client.patch<User>("/auth/me/", payload),
  advisers: (params: { search?: string; group?: number } = {}) =>
    client.get<Paginated<Adviser>>("/auth/advisers/", { params }),
  users: (params: Record<string, string> = {}) =>
    client.get<Paginated<User>>("/auth/users/", { params }),
  createFaculty: (payload: Record<string, unknown>) => client.post("/auth/users/", payload),
  verifyFaculty: (id: number) => client.post(`/auth/users/${id}/verify_faculty/`),
};

// -------------------------------------------------------------- groups
export const groupsApi = {
  list: (params: Record<string, string> = {}) =>
    client.get<Paginated<ThesisGroup>>("/groups/", { params }),
  get: (id: number) => client.get<ThesisGroup>(`/groups/${id}/`),
  create: (payload: { name: string; thesis_title?: string }) =>
    client.post<ThesisGroup>("/groups/", payload),
  update: (id: number, payload: Partial<{ name: string; thesis_title: string }>) =>
    client.patch<ThesisGroup>(`/groups/${id}/`, payload),
  addMember: (id: number, studentId: number) =>
    client.post(`/groups/${id}/add_member/`, { student_id: studentId }),
  removeMember: (id: number, memberId: number) =>
    client.post(`/groups/${id}/remove_member/`, { member_id: memberId }),
  assignAdviser: (id: number, adviserId: number) =>
    client.post(`/groups/${id}/assign_adviser/`, { adviser_id: adviserId }),
  approve: (id: number) => client.post(`/groups/${id}/approve/`),
  reject: (id: number) => client.post(`/groups/${id}/reject/`),
  archive: (id: number) => client.post(`/groups/${id}/archive/`),
  markReady: (id: number) => client.post(`/groups/${id}/mark_ready/`),
  advanceStage: (id: number) => client.post(`/groups/${id}/advance_stage/`),
  nominatePanel: (id: number, facultyId: number) =>
    client.post(`/groups/${id}/nominate_panel/`, { faculty_id: facultyId }),
  panelAssignments: (params: Record<string, string> = {}) =>
    client.get<Paginated<PanelAssignment & { group: number }>>("/groups/panel-assignments/", {
      params,
    }),
  approvePanel: (id: number) => client.post(`/groups/panel-assignments/${id}/approve/`),
  rejectPanel: (id: number) => client.post(`/groups/panel-assignments/${id}/reject/`),
};

// -------------------------------------------------------------- theses
export const thesesApi = {
  topics: (params: Record<string, string> = {}) =>
    client.get<Paginated<ThesisTopic>>("/theses/topics/", { params }),
  submitTopic: (payload: { group: number; title: string; abstract: string }) =>
    client.post<ThesisTopic>("/theses/topics/", payload),
  approveTopic: (id: number, feedback = "") =>
    client.post(`/theses/topics/${id}/approve/`, { feedback }),
  rejectTopic: (id: number, feedback = "") =>
    client.post(`/theses/topics/${id}/reject/`, { feedback }),
};

// ----------------------------------------------------------- documents
export const documentsApi = {
  list: (params: Record<string, string> = {}) =>
    client.get<Paginated<ThesisDocument>>("/documents/", { params }),
  link: (payload: Record<string, unknown>) => client.post<ThesisDocument>("/documents/", payload),
  newVersion: (id: number, payload: Record<string, unknown>) =>
    client.post<ThesisDocument>(`/documents/${id}/new_version/`, payload),
  approve: (id: number, feedback = "") => client.post(`/documents/${id}/approve/`, { feedback }),
  requestRevision: (id: number, feedback = "") =>
    client.post(`/documents/${id}/request_revision/`, { feedback }),
  reject: (id: number, feedback = "") => client.post(`/documents/${id}/reject/`, { feedback }),
};

// ----------------------------------------------------------- schedules
export const schedulesApi = {
  list: (params: Record<string, string> = {}) =>
    client.get<Paginated<DefenseSchedule>>("/defenses/schedules/", { params }),
  propose: (payload: Record<string, unknown>) =>
    client.post<DefenseSchedule>("/defenses/schedules/", payload),
  approve: (id: number) => client.post(`/defenses/schedules/${id}/approve/`),
  reject: (id: number, remarks = "") =>
    client.post(`/defenses/schedules/${id}/reject/`, { remarks }),
  evaluate: (id: number, verdict: string, comments: string) =>
    client.post(`/defenses/schedules/${id}/evaluate/`, { schedule: id, verdict, comments }),
  recordResult: (id: number, verdict: string, remarks: string) =>
    client.post(`/defenses/schedules/${id}/record_result/`, { schedule: id, verdict, remarks }),
  checkConflicts: (params: Record<string, string>) =>
    client.get<{ conflicts: ScheduleConflict[] }>("/defenses/schedules/check_conflicts/", { params }),
  suggestSlots: (params: Record<string, string>) =>
    client.get<{ slots: ScheduleSlot[] }>("/defenses/schedules/suggest_slots/", { params }),
  downloadCertificate: async (id: number) => {
    const { data } = await client.get(`/defenses/schedules/${id}/certificate/`, { responseType: "blob" });
    const url = URL.createObjectURL(data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `defense-certificate-${id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  },
};

// ------------------------------------------------------- notifications
export const notificationsApi = {
  list: () => client.get<Paginated<Notification>>("/notifications/"),
  unreadCount: () => client.get<{ count: number }>("/notifications/unread_count/"),
  markRead: (id: number) => client.post(`/notifications/${id}/mark_read/`),
  markAllRead: () => client.post("/notifications/mark_all_read/"),
};

// -------------------------------------------------- Google integration
export const googleApi = {
  status: () => client.get<{ connected: boolean }>("/integrations/google/status/"),
  authorize: () => client.get<{ authorization_url: string }>("/integrations/google/authorize/"),
  createDoc: (groupId: number, title: string) =>
    client.post<{ drive_file_id: string; drive_link: string }>(
      "/integrations/google/create-doc/",
      { group_id: groupId, title },
    ),
};

// ------------------------------------------------- collaboration & reports
import type { Comment, Milestone, ReportSummary } from "../types";

export const collaborationApi = {
  comments: (groupId: number) =>
    client.get<Paginated<Comment>>("/collaboration/comments/", { params: { group: groupId } }),
  post: (groupId: number, body: string) =>
    client.post<Comment>("/collaboration/comments/", { group: groupId, body }),
};

export const milestonesApi = {
  list: (params: Record<string, string> = {}) =>
    client.get<Paginated<Milestone>>("/groups/milestones/", { params }),
  create: (payload: { group: number; title: string; stage: string; due_date: string }) =>
    client.post<Milestone>("/groups/milestones/", payload),
  complete: (id: number) => client.post(`/groups/milestones/${id}/complete/`),
};

export const reportsApi = {
  summary: () => client.get<ReportSummary>("/reports/summary/"),
};

/** WebSocket URL for a path like "notifications" or "groups/3". */
export function wsUrl(path: string): string {
  const api = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";
  const base = api.replace(/\/api\/?$/, "").replace(/^http/, "ws");
  const token = localStorage.getItem("envisys_access") ?? "";
  return `${base}/ws/${path}/?token=${token}`;
}
