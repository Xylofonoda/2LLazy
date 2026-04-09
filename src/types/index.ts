/**
 * Shared UI types used across pages and components.
 * Keep separate from src/lib/scrapers/types.ts (backend scraper types).
 */

export type AppStatus = "PENDING" | "APPLIED" | "REJECTED" | "INTERVIEW" | "OFFER" | "FAILED";

export const ALL_STATUSES: AppStatus[] = [
  "PENDING",
  "APPLIED",
  "REJECTED",
  "INTERVIEW",
  "OFFER",
  "FAILED",
];

export const STATUS_COLOR: Record<
  AppStatus,
  "default" | "info" | "success" | "error" | "warning"
> = {
  PENDING: "default",
  APPLIED: "info",
  REJECTED: "error",
  INTERVIEW: "success",
  OFFER: "success",
  FAILED: "warning",
};

export type SourceChipColor =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "info"
  | "error"
  | "default";

export const SOURCE_COLOR: Record<string, SourceChipColor> = {
  STARTUPJOBS: "success",
  JOBSTACK: "warning",
  COCUMA: "info",
  SKILLETO: "secondary",
  NOFLUFFJOBS: "primary",
  JOBSCZ: "error",
  GLASSDOOR: "success",
  JOOBLE: "warning",
};

/** Unified job item used in search results and favourites. */
export interface JobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
  source: string;
  salary?: string;
  workType?: string;
  /** Only present on search results (0–1 cosine similarity). */
  similarity?: number;
  favourited?: boolean;
  /** Latest generated cover letter for this job, if any. */
  coverLetter?: { id: string; content: string } | null;
  /** True if the job was first seen in the DB within the last 24 hours. */
  isNew?: boolean;
}

export interface ApplicationInterview {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  notes: string | null;
}

export interface Application {
  id: string;
  status: AppStatus;
  appliedAt: string | null;
  errorMessage: string | null;
  notes?: string | null;
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
    source: string;
    sourceUrl: string;
    salary: string | null;
  };
  coverLetter: { id: string; content: string } | null;
  interview: ApplicationInterview | null;
}

export interface Interview {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
  notes: string | null;
  application: {
    id: string;
    job: { title: string; company: string };
  };
}

export interface ScheduleInterviewForm {
  applicationId: string;
  scheduledAt: string;
  durationMinutes: number;
  notes: string;
}

/** Unified display entry for the calendar — covers linked interviews and free-form events. */
export interface CalendarEntry {
  id: string;
  type: "interview" | "event";
  /** For event: user-supplied title. For interview: company name. */
  title: string;
  /** For interview: job title. Undefined for events. */
  subtitle?: string;
  scheduledAt: string;
  durationMinutes: number;
  notes: string | null;
}

export interface CalendarEventForm {
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  notes: string;
}

// ─── Settings types ───────────────────────────────────────────────────────────

export interface SiteCredStatus {
  site: string;
  configured: boolean;
  username: string | null;
}

export interface UploadedFile {
  id: string;
  filename: string;
  size: number;
  uploadedAt: string;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  linkedInUrl: string;
  githubUrl: string;
  coverLetterLanguage: string;
}
