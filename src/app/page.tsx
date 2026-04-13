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
  Switch,
  FormControlLabel,
  Tooltip,
  Alert,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { JobCard } from "@/components/jobs/JobCard";
import { JobFilterBar, type JobFilters, DEFAULT_JOB_FILTERS } from "@/components/jobs/JobFilterBar";
import { ErrorAlertList } from "@/components/ui/ErrorAlertList";
import type { JobItem } from "@/types";
import { useScrapeProgress } from "@/context/ScrapeProgressContext";
import { ios } from "@/theme/theme";

type JobResult = JobItem;

interface ScrapeEvent {
  type: "progress" | "job" | "complete" | "error" | "scraperDone";
  site?: string;
  message?: string;
  data?: JobResult;
  total?: number;
  doneCount?: number;
}

const SKILL_LEVELS = ["Junior", "Mid", "Senior", "Lead", "Any"];

export default function SearchPage() {
  const queryInputRef = useRef<HTMLInputElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const [skillLevel, setSkillLevel] = useState("Any");
  const [deepSearch, setDeepSearch] = useState(false);
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const { scraping, setScraping, scrapePercent, setScrapePercent } = useScrapeProgress();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_JOB_FILTERS);
  const abortRef = useRef<AbortController | null>(null);
  // Track which job IDs arrived via the live SSE stream (not restored from sessionStorage)
  const newJobIdsRef = useRef<Set<string>>(new Set());
  // Maps job ID → arrival index so we can stagger the entrance animation delay
  const jobArrivalIndexRef = useRef<Map<string, number>>(new Map());
  const arrivalCountRef = useRef(0);
  const uniqueJobCountRef = useRef(0);

  // Restore last search session when navigating back to this page
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("job_search_session");
      if (saved) {
        const p = JSON.parse(saved) as {
          jobs?: JobResult[];
          query?: string;
          city?: string;
          skillLevel?: string;
          deepSearch?: boolean;
          progress?: string;
          errors?: string[];
        };
        if (p.jobs?.length) setJobs(p.jobs.map((j) => ({ ...j, description: j.description ? j.description + "…" : "" })));
        if (p.query && queryInputRef.current) queryInputRef.current.value = p.query;
        if (p.city && cityInputRef.current) cityInputRef.current.value = p.city ?? "";
        if (p.skillLevel) setSkillLevel(p.skillLevel);
        if (p.deepSearch !== undefined) setDeepSearch(p.deepSearch);
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
        JSON.stringify({ ...parsed, skillLevel, deepSearch, progress, errors }),
      );
    } catch { /* storage quota exceeded */ }
  }, [skillLevel, deepSearch, progress, errors, scraping]);

  const handleSearch = async () => {
    const q = queryInputRef.current?.value.trim() ?? "";
    const city = cityInputRef.current?.value.trim() ?? "";
    if (scraping || !q) return; // guard against double-submit (button + Enter)
    // Save query to session at submit time so it restores on navigation
    try {
      const existing = sessionStorage.getItem("job_search_session");
      const parsed = existing ? JSON.parse(existing) : {};
      sessionStorage.setItem("job_search_session", JSON.stringify({ ...parsed, query: q, city }));
    } catch { /* storage quota exceeded */ }
    setJobs([]);
    setErrors([]);
    setFilters(DEFAULT_JOB_FILTERS);
    newJobIdsRef.current = new Set();
    jobArrivalIndexRef.current = new Map();
    arrivalCountRef.current = 0;
    uniqueJobCountRef.current = 0;
    setScraping(true);
    setScrapePercent(0);
    setProgress("Starting scrape...");

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, skillLevel, deepSearch, city }),
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
            } else if (event.type === "scraperDone" && event.doneCount != null && event.total != null) {
              setScrapePercent(Math.round((event.doneCount / event.total) * 100));
            } else if (event.type === "job" && event.data) {
              const jobId = event.data.id;
              if (!newJobIdsRef.current.has(jobId)) {
                newJobIdsRef.current.add(jobId);
                jobArrivalIndexRef.current.set(jobId, arrivalCountRef.current++);
              }
              setJobs((prev) => {
                const exists = prev.some((j) => j.id === event.data!.id);
                if (!exists) uniqueJobCountRef.current++;
                return exists ? prev : [...prev, event.data!];
              });
            } else if (event.type === "complete") {
              setScrapePercent(100);
              setProgress(uniqueJobCountRef.current === 0 ? "done-empty" : null);
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
              if (!exists) uniqueJobCountRef.current++;
              return exists ? prev : [...prev, event.data!];
            });
          } else if (event.type === "complete") {
            setScrapePercent(100);
            setProgress(uniqueJobCountRef.current === 0 ? "done-empty" : null);
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


  const filteredJobs = jobs
    .filter((job) => {
      if (filters.source !== "ALL" && job.source !== filters.source) return false;
      if (filters.hasSalary && !job.salary) return false;
      if (filters.workType !== "ALL" && job.workType && job.workType !== filters.workType) return false;
      if (filters.city.trim()) {
        const cityQ = filters.city.toLowerCase();
        if (!job.location.toLowerCase().includes(cityQ)) return false;
      }
      if (filters.salaryMin || filters.salaryMax) {
        if (!job.salary) return false;
        const nums = job.salary.match(/[\d\s]+/g)?.map((n) => parseInt(n.replace(/\s/g, ""), 10)).filter((n) => !isNaN(n) && n > 0) ?? [];
        if (nums.length > 0) {
          const mid = nums.reduce((a, b) => a + b, 0) / nums.length;
          if (filters.salaryMin && mid < parseInt(filters.salaryMin, 10)) return false;
          if (filters.salaryMax && mid > parseInt(filters.salaryMax, 10)) return false;
        }
      }
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

  const freshJobs = filteredJobs
    .filter((j) => !j.isStale)
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

  const staleJobs = filteredJobs
    .filter((j) => j.isStale)
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

  return (
    <Box>
      <GlobalStyles
        styles={{
          "@keyframes jobSlideIn": {
            from: { opacity: 0, transform: "translateY(14px) scale(0.99)" },
            to:   { opacity: 1, transform: "translateY(0) scale(1)" },
          },
        }}
      />

      {/* ── Page header ──────────────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 0.5 }}>
          Find Jobs
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Enter a role and skill level — results ranked by semantic match.
        </Typography>
      </Box>

      {/* ── Search card ──────────────────────────────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: "16px !important" }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems="flex-end"
          >
            <TextField
              label="Job Position"
              placeholder="e.g. Frontend Developer, Data Engineer"
              inputRef={queryInputRef}
              defaultValue=""
              onKeyDown={(e) => e.key === "Enter" && !scraping && handleSearch()}
              fullWidth
              variant="outlined"
              size="small"
            />
            <TextField
              label="City (optional)"
              placeholder="e.g. Praha, Brno"
              inputRef={cityInputRef}
              defaultValue=""
              onKeyDown={(e) => e.key === "Enter" && !scraping && handleSearch()}
              variant="outlined"
              size="small"
              sx={{ minWidth: 160, flexShrink: 0 }}
            />
            <FormControl size="small" sx={{ minWidth: 130, flexShrink: 0 }}>
              <InputLabel>Skill Level</InputLabel>
              <Select
                value={skillLevel}
                label="Skill Level"
                onChange={(e) => setSkillLevel(e.target.value)}
              >
                {SKILL_LEVELS.map((l) => (
                  <MenuItem key={l} value={l}>{l}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={scraping ? <CircularProgress size={15} color="inherit" /> : <SearchIcon />}
              onClick={handleSearch}
              disabled={scraping}
              sx={{ minWidth: 120, height: 40, flexShrink: 0 }}
            >
              {scraping ? "Searching…" : "Search"}
            </Button>
          </Stack>

          {scraping && <LinearProgress sx={{ mt: 2 }} />}

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
            <Tooltip title="Scrapes multiple pages per site — slower but finds more results.">
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={deepSearch}
                    onChange={(e) => setDeepSearch(e.target.checked)}
                    disabled={scraping}
                  />
                }
                label={
                  <Typography variant="caption" color="text.secondary">
                    Deep Search
                  </Typography>
                }
                sx={{ ml: 0, gap: 0.5 }}
              />
            </Tooltip>
            {progress && (
              <Typography variant="caption" color="text.secondary">
                {progress}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      <ErrorAlertList
        errors={errors}
        onDismiss={(i) => setErrors((prev) => prev.filter((_, j) => j !== i))}
      />

      {!scraping && jobs.length === 0 && !progress && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Start with a role like <strong>Frontend Developer</strong> or <strong>Data Engineer</strong>, then press Search.
        </Alert>
      )}

      {!scraping && jobs.length === 0 && progress === "done-empty" && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No jobs found. Try broader keywords, set skill level to <strong>Any</strong>, or enable <strong>Deep Search</strong>.
        </Alert>
      )}

      {jobs.length > 0 && (
        <>
          <JobFilterBar sources={Array.from(new Set(jobs.map((j) => j.source))).sort()} filters={filters} onChange={setFilters} />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 500 }}>
            {filteredJobs.length === jobs.length
              ? `${jobs.length} results`
              : `${filteredJobs.length} of ${jobs.length} results`}
            {staleJobs.length > 0 && (
              <Box component="span" sx={{ color: ios.label3, ml: 1 }}>
                ({freshJobs.length} fresh · {staleJobs.length} cached)
              </Box>
            )}
          </Typography>
        </>
      )}

      {scraping && jobs.length === 0 && (
        <Stack spacing={2} sx={{ mt: 1 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
          ))}
        </Stack>
      )}

      <Stack spacing={1.5}>
        {freshJobs.map((job) => {
          const isNew = newJobIdsRef.current.has(job.id);
          const delay = isNew
            ? Math.min((jobArrivalIndexRef.current.get(job.id) ?? 0) * 50, 800)
            : 0;
          return (
            <Box
              key={job.id}
              sx={isNew ? {
                animation: "jobSlideIn 0.38s cubic-bezier(0.34,1.2,0.64,1) both",
                animationDelay: `${delay}ms`,
              } : undefined}
            >
              <JobCard
                job={job}
                isToggling={togglingId === job.id}
                onToggleFavourite={handleToggleFavourite}
              />
            </Box>
          );
        })}
      </Stack>

      {staleJobs.length > 0 && (
        <>
          <Box sx={{ mt: 3, mb: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            <Typography variant="caption" sx={{ color: ios.label3, fontWeight: 600, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
              PREVIOUSLY FOUND ({staleJobs.length})
            </Typography>
            <Box sx={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          </Box>
          <Stack spacing={1.5}>
            {staleJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isToggling={togglingId === job.id}
                onToggleFavourite={handleToggleFavourite}
              />
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}

