/** Shared types mirroring the EnviSys API. */

export type Role = "STUDENT" | "FACULTY" | "ADMIN";
export type Stage = "CONCEPT" | "PROPOSAL" | "FINAL";
export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DocumentStatus = "PENDING" | "APPROVED" | "REVISION" | "REJECTED";
export type ScheduleStatus = "PROPOSED" | "APPROVED" | "REJECTED" | "COMPLETED";

export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: Role;
  specialization: string;
  is_verified_faculty: boolean;
  student_id: string;
  is_email_verified: boolean;
}

export interface Adviser {
  id: number;
  full_name: string;
  email: string;
  specialization: string;
  active_advisees: number;
  match_score: number | null;
}

export interface GroupMember {
  id: number;
  student: User;
  member_role: "LEADER" | "MEMBER";
  joined_at: string;
}

export interface PanelAssignment {
  id: number;
  group: number;
  group_name: string;
  faculty: User;
  status: "NOMINATED" | "APPROVED" | "REJECTED";
  created_at: string;
}

export interface ThesisGroup {
  id: number;
  name: string;
  thesis_title: string;
  adviser: User | null;
  stage: Stage;
  status: ReviewStatus;
  ready_for_defense: boolean;
  drive_folder_link: string;
  is_archived: boolean;
  members: GroupMember[];
  panel_assignments: PanelAssignment[];
  created_at: string;
}

export interface ThesisTopic {
  id: number;
  group: number;
  group_name: string;
  title: string;
  abstract: string;
  status: ReviewStatus;
  submitted_by: User | null;
  reviewed_by: User | null;
  feedback: string;
  created_at: string;
}

export interface ThesisDocument {
  id: number;
  group: number;
  group_name: string;
  title: string;
  doc_type: string;
  stage: Stage;
  drive_link: string;
  version: number;
  status: DocumentStatus;
  feedback: string;
  uploaded_by: User | null;
  created_at: string;
}

export interface Evaluation {
  id: number;
  schedule: number;
  evaluator: User;
  verdict: string;
  comments: string;
  created_at: string;
}

export interface DefenseResult {
  id: number;
  schedule: number;
  verdict: string;
  remarks: string;
  recorded_by: User | null;
  created_at: string;
}

export interface ScheduleConflict {
  schedule_id: number;
  group_name: string;
  reason: string;
}

export interface ScheduleSlot {
  date: string;
  time: string;
}

export interface DefenseSchedule {
  id: number;
  group: number;
  group_name: string;
  stage: Stage;
  date: string;
  time: string;
  duration_minutes: number;
  location: string;
  status: ScheduleStatus;
  remarks: string;
  proposed_by: User | null;
  evaluations: Evaluation[];
  result: DefenseResult | null;
  voters_total: number;
  voters_evaluated: number;
  suggested_verdict: string | null;
  created_at: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Comment {
  id: number;
  group: number;
  document: number | null;
  author: User;
  body: string;
  created_at: string;
}

export interface Milestone {
  id: number;
  group: number;
  group_name: string;
  title: string;
  stage: Stage;
  due_date: string;
  is_completed: boolean;
  is_overdue: boolean;
  created_at: string;
}

export interface ReportSummary {
  groups_total: number;
  groups_by_stage: Record<Stage, number>;
  groups_ready_for_defense: number;
  pending_topics: number;
  pending_documents: number;
  upcoming_defenses: number;
  overdue_milestones: number;
  pending_group_approvals?: number;
  pending_panel_nominations?: number;
  pending_schedules?: number;
  pending_results?: number;
  archived_theses?: number;
}
