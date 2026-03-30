"use client";

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Skeleton,
  GlobalStyles,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { JobCard } from "@/components/jobs/JobCard";
import { JobFilterBar, type JobFilters, DEFAULT_JOB_FILTERS } from "@/components/jobs/JobFilterBar";
import { StreamingCoverLetterDialog } from "@/components/dialogs/StreamingCoverLetterDialog";
import { ErrorAlertList } from "@/components/ui/ErrorAlertList";
import type { JobItem } from "@/types";

type JobResult = JobItem;

interface ScrapeEvent {
  type: "progress" | "job" | "complete" | "error";
  site?: string;
  message?: string;
  data?: JobResult;
  total?: number;
}

const SKILL_LEVELS = ["Junior", "Mid", "Senior", "Lead", "Any"];

export default function SearchPage() {
  const queryInputRef = useRef<HTMLInputElement>(null);
  const [skillLevel, setSkillLevel] = useState("Any");
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_JOB_FILTERS);
  const [streamDlg, setStreamDlg] = useState<{ open: boolean; jobId: string | null; jobTitle: string }>({
    open: false,
    jobId: null,
    jobTitle: "",
  });
  const abortRef = useRef<AbortController | null>(null);
  // Track which job IDs arrived via the live SSE stream (not restored from sessionStorage)
  const newJobIdsRef = useRef<Set<string>>(new Set());
  // Maps job ID → arrival index so we can stagger the entrance animation delay
  const jobArrivalIndexRef = useRef<Map<string, number>>(new Map());
  const arrivalCountRef = useRef(0);

  // Restore last search session when navigating back to this page
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("job_search_session");
      if (saved) {
        const p = JSON.parse(saved) as {
          jobs?: JobResult[];
          query?: string;
          skillLevel?: string;
          progress?: string;
          errors?: string[];
        };
        if (p.jobs?.length) setJobs(p.jobs.map((j) => ({ ...j, description: j.description ? j.description + "…" : "" })));
        if (p.query && queryInputRef.current) queryInputRef.current.value = p.query;
        if (p.skillLevel) setSkillLevel(p.skillLevel);
        // Only restore a terminal progress message, not a mid-scrape one
        if (p.progress && !p.progress.startsWith("Scraping") && !p.progress.startsWith("Starting")) {
          setProgress(p.progress);
        }
        if (p.errors?.length) setErrors(p.errors);
      }
    } catch { /* corrupt / unavailable */ }
  }, []);

  // Persist the job list only when it actually changes (avoids stringify on every keystroke)
  useEffect(() => {
    if (scraping || !jobs.length) return;
    try {
      const existing = sessionStorage.getItem("job_search_session");
      const parsed = existing ? JSON.parse(existing) : {};
      sessionStorage.setItem(
        "job_search_session",
        JSON.stringify({ ...parsed, jobs: jobs.map(({ description, ...rest }) => ({ ...rest, description: description?.slice(0, 300) ?? "" })) }),
      );
    } catch { /* storage quota exceeded */ }
  }, [jobs, scraping]);

  // Persist cheap scalar values when they change (query is saved at search-submit time, not here)
  useEffect(() => {
    if (scraping) return;
    try {
      const existing = sessionStorage.getItem("job_search_session");
      const parsed = existing ? JSON.parse(existing) : {};
      sessionStorage.setItem(
        "job_search_session",
        JSON.stringify({ ...parsed, skillLevel, progress, errors }),
      );
    } catch { /* storage quota exceeded */ }
  }, [skillLevel, progress, errors, scraping]);

  const handleSearch = async () => {
    const q = queryInputRef.current?.value.trim() ?? "";
    if (scraping || !q) return; // guard against double-submit (button + Enter)
    // Save query to session at submit time so it restores on navigation
    try {
      const existing = sessionStorage.getItem("job_search_session");
      const parsed = existing ? JSON.parse(existing) : {};
      sessionStorage.setItem("job_search_session", JSON.stringify({ ...parsed, query: q }));
    } catch { /* storage quota exceeded */ }
    setJobs([]);
    setErrors([]);
    setFilters(DEFAULT_JOB_FILTERS);
    newJobIdsRef.current = new Set();
    jobArrivalIndexRef.current = new Map();
    arrivalCountRef.current = 0;
    setScraping(true);
    setProgress("Starting scrape...");

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, skillLevel }),
        signal: abortRef.current.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      // Buffer incomplete lines across chunk boundaries — large descriptions can
      // split a single `data: {...}` line across multiple reader.read() calls.
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });

        // Process every complete line (terminated by \n)
        const parts = buf.split("\n");
        // Keep the last part — it may be an incomplete line
        buf = parts.pop() ?? "";

        for (const line of parts) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as ScrapeEvent;
            if (event.type === "progress") {
              setProgress(event.message ?? null);
            } else if (event.type === "job" && event.data) {
              const jobId = event.data.id;
              if (!newJobIdsRef.current.has(jobId)) {
                newJobIdsRef.current.add(jobId);
                jobArrivalIndexRef.current.set(jobId, arrivalCountRef.current++);
              }
              setJobs((prev) => {
                const exists = prev.some((j) => j.id === event.data!.id);
                return exists ? prev : [...prev, event.data!];
              });
            } else if (event.type === "complete") {
              setProgress(`Done — ${event.total} jobs found`);
              setScraping(false);
            } else if (event.type === "error") {
              setErrors((prev) => [...prev, `${event.site}: ${event.message}`]);
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }

      // Flush any remaining buffered content after stream ends
      if (buf.startsWith("data: ")) {
        try {
          const event = JSON.parse(buf.slice(6)) as ScrapeEvent;
          if (event.type === "job" && event.data) {
            setJobs((prev) => {
              const exists = prev.some((j) => j.id === event.data!.id);
              return exists ? prev : [...prev, event.data!];
            });
          } else if (event.type === "complete") {
            setProgress(`Done — ${event.total} jobs found`);
            setScraping(false);
          }
        } catch { /* incomplete */ }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setErrors((prev) => [...prev, "Scrape failed: " + String(err)]);
      }
    } finally {
      setScraping(false);
    }
  };

  const handleToggleFavourite = async (job: JobResult) => {
    setTogglingId(job.id);
    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation Fav($jobId: ID!) { toggleFavourite(jobId: $jobId) { id favourited } }`,
          variables: { jobId: job.id },
        }),
      });
      const data = await res.json();
      if (data.errors) throw new Error(data.errors[0].message);
      const updated: { id: string; favourited: boolean } = data.data.toggleFavourite;
      setJobs((prev) =>
        prev.map((j) =>
          j.id === updated.id ? { ...j, favourited: updated.favourited } : j,
        ),
      );
    } catch (err) {
      setErrors((prev) => [...prev, `Favourite failed: ${String(err)}`]);
    } finally {
      setTogglingId(null);
    }
  };

  const handleApply = async (job: JobResult) => {
    setApplyingId(job.id);
    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation Apply($jobId: ID!) { applyToJob(jobId: $jobId) { id status } }`,
          variables: { jobId: job.id },
        }),
      });
      const data = await res.json();
      if (data.errors) throw new Error(data.errors[0].message);
    } catch (err) {
      setErrors((prev) => [
        ...prev,
        `Apply failed for ${job.title}: ${String(err)}`,
      ]);
    } finally {
      setApplyingId(null);
    }
  };

  const handleGenerateCoverLetter = (job: JobResult) => {
    setStreamDlg({ open: true, jobId: job.id, jobTitle: job.title });
  };

  const handleStreamComplete = (jobId: string) => {
    setStreamDlg({ open: false, jobId: null, jobTitle: "" });
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, favourited: true } : j)),
    );
  };

  const filteredJobs = jobs.filter((job) => {
    if (filters.source !== "ALL" && job.source !== filters.source) return false;
    if (filters.hasSalary && !job.salary) return false;
    if (filters.position.trim()) {
      const q = filters.position.toLowerCase();
      if (
        !job.title.toLowerCase().includes(q) &&
        !job.company.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  return (
    <Box>
      <GlobalStyles
        styles={{
          "@keyframes jobSlideIn": {
            from: { opacity: 0, transform: "translateY(18px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      />
      <Typography variant="h4" gutterBottom>
        Find &amp; Apply to Jobs
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter a role and skill level. Results are focused on Czechia and ranked
        by semantic similarity.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems="flex-end"
          >
            <TextField
              label="Job Position"
              placeholder="e.g. Frontend Developer, Data Engineer"
              inputRef={queryInputRef}
              defaultValue=""
              onKeyDown={(e) =>
                e.key === "Enter" && !scraping && handleSearch()
              }
              fullWidth
              variant="outlined"
              size="small"
            />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Skill Level</InputLabel>
              <Select
                value={skillLevel}
                label="Skill Level"
                onChange={(e) => setSkillLevel(e.target.value)}
              >
                {SKILL_LEVELS.map((l) => (
                  <MenuItem key={l} value={l}>
                    {l}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              disabled={scraping}
              sx={{ minWidth: 120, height: 40 }}
            >
              {scraping ? "Searching..." : "Search"}
            </Button>
          </Stack>
          {scraping && <LinearProgress sx={{ mt: 2 }} />}
          {progress && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: "block" }}
            >
              {progress}
            </Typography>
          )}
        </CardContent>
      </Card>

      <ErrorAlertList
        errors={errors}
        onDismiss={(i) => setErrors((prev) => prev.filter((_, j) => j !== i))}
      />

      {jobs.length > 0 && (
        <>
          <JobFilterBar sources={Array.from(new Set(jobs.map((j) => j.source))).sort()} filters={filters} onChange={setFilters} />
          <Typography variant="h6" sx={{ mb: 2 }}>
            {filteredJobs.length === jobs.length
              ? `${jobs.length} results`
              : `${filteredJobs.length} of ${jobs.length} results`}
          </Typography>
        </>
      )}

      {scraping && jobs.length === 0 && (
        <Stack spacing={2} sx={{ mt: 2 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={180} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      )}

      <Stack spacing={2}>
        {filteredJobs.map((job) => {
          const isNew = newJobIdsRef.current.has(job.id);
          const delay = isNew
            ? Math.min((jobArrivalIndexRef.current.get(job.id) ?? 0) * 55, 900)
            : 0;
          return (
            <Box
              key={job.id}
              sx={isNew ? {
                animation: "jobSlideIn 0.42s ease-out both",
                animationDelay: `${delay}ms`,
              } : undefined}
            >
              <JobCard
                job={job}
                isApplying={applyingId === job.id}
                isGenerating={streamDlg.open && streamDlg.jobId === job.id}
                isToggling={togglingId === job.id}
                onApply={handleApply}
                onGenerateCoverLetter={handleGenerateCoverLetter}
                onToggleFavourite={handleToggleFavourite}
              />
            </Box>
          );
        })}
      </Stack>

      <StreamingCoverLetterDialog
        open={streamDlg.open}
        jobId={streamDlg.jobId}
        jobTitle={streamDlg.jobTitle}
        onClose={() => setStreamDlg({ open: false, jobId: null, jobTitle: "" })}
        onComplete={() => handleStreamComplete(streamDlg.jobId ?? "")}
      />
    </Box>
  );
}

