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
  CardActions,
  Chip,
  LinearProgress,
  Stack,
  Alert,
  IconButton,
  Tooltip,
  Divider,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SendIcon from "@mui/icons-material/Send";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";

interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
  source: string;
  salary?: string;
  similarity?: number;
  favourited?: boolean;
}

interface ScrapeEvent {
  type: "progress" | "job" | "complete" | "error";
  site?: string;
  message?: string;
  data?: JobResult;
  total?: number;
}

const SKILL_LEVELS = ["Junior", "Mid", "Senior", "Lead", "Any"];
const SOURCE_COLOR: Record<string, "primary" | "secondary" | "success" | "warning" | "info" | "error"> = {
  LINKEDIN: "primary",
  INDEED: "info",
  STARTUPJOBS: "success",
  JOBSTACK: "warning",
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [skillLevel, setSkillLevel] = useState("Mid");
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

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
        if (p.jobs?.length) setJobs(p.jobs);
        if (p.query) setQuery(p.query);
        if (p.skillLevel) setSkillLevel(p.skillLevel);
        // Only restore a terminal progress message, not a mid-scrape one
        if (p.progress && !p.progress.startsWith("Scraping") && !p.progress.startsWith("Starting")) {
          setProgress(p.progress);
        }
        if (p.errors?.length) setErrors(p.errors);
      }
    } catch { /* corrupt / unavailable */ }
  }, []);

  // Persist state to sessionStorage whenever it changes
  useEffect(() => {
    if (scraping) return; // don't snapshot mid-scrape
    try {
      sessionStorage.setItem(
        "job_search_session",
        JSON.stringify({ jobs, query, skillLevel, progress, errors }),
      );
    } catch { /* storage quota exceeded */ }
  }, [jobs, query, skillLevel, progress, errors, scraping]);

  const handleSearch = async () => {
    if (scraping || !query.trim()) return; // guard against double-submit (button + Enter)
    setJobs([]);
    setErrors([]);
    setScraping(true);
    setProgress("Starting scrape...");

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, skillLevel }),
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
      setJobs((prev) => prev.map((j) => j.id === updated.id ? { ...j, favourited: updated.favourited } : j));
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
      setErrors((prev) => [...prev, `Apply failed for ${job.title}: ${String(err)}`]);
    } finally {
      setApplyingId(null);
    }
  };

  const handleGenerateCoverLetter = async (job: JobResult) => {
    setGeneratingId(job.id);
    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation GenCL($jobId: ID!) { generateCoverLetter(jobId: $jobId) { id content } }`,
          variables: { jobId: job.id },
        }),
      });
      const data = await res.json();
      if (data.errors) throw new Error(data.errors[0].message);
    } catch (err) {
      setErrors((prev) => [...prev, `Cover letter failed: ${String(err)}`]);
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Find &amp; Apply to Jobs
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter a role and skill level. Results are focused on Czechia and ranked by semantic similarity.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-end">
            <TextField
              label="Job Position"
              placeholder="e.g. Frontend Developer, Data Engineer"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !scraping && handleSearch()}
              fullWidth
              variant="outlined"
              size="small"
            />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Skill Level</InputLabel>
              <Select value={skillLevel} label="Skill Level" onChange={(e) => setSkillLevel(e.target.value)}>
                {SKILL_LEVELS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              disabled={scraping || !query.trim()}
              sx={{ minWidth: 120, height: 40 }}
            >
              {scraping ? "Searching..." : "Search"}
            </Button>
          </Stack>
          {scraping && <LinearProgress sx={{ mt: 2 }} />}
          {progress && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              {progress}
            </Typography>
          )}
        </CardContent>
      </Card>

      {errors.map((e, i) => (
        <Alert key={i} severity="warning" sx={{ mb: 1 }} onClose={() => setErrors((prev) => prev.filter((_, j) => j !== i))}>
          {e}
        </Alert>
      ))}

      {jobs.length > 0 && <Typography variant="h6" sx={{ mb: 2 }}>{jobs.length} results</Typography>}

      <Stack spacing={2}>
        {jobs.map((job) => (
          <Card key={job.id}>
            <CardContent sx={{ pb: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="h6" sx={{ fontSize: 16 }}>{job.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{job.company} · {job.location}</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  {job.similarity !== undefined && (
                    <Chip label={`${(job.similarity * 100).toFixed(0)}% match`} size="small" color="success" variant="outlined" />
                  )}
                  <Chip label={job.source} size="small" color={SOURCE_COLOR[job.source] ?? "default"} variant="outlined" />
                </Stack>
              </Stack>
              {job.salary && <Typography variant="body2" color="success.main" sx={{ mt: 0.5 }}>{job.salary}</Typography>}
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
              >
                {job.description || "No description available."}
              </Typography>
            </CardContent>
            <Divider />
            <CardActions sx={{ px: 2, py: 1 }}>
              <Button size="small" variant="contained" startIcon={<SendIcon />} onClick={() => handleApply(job)} disabled={applyingId === job.id}>
                {applyingId === job.id ? "Applying..." : "Auto-Apply"}
              </Button>
              <Button size="small" variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={() => handleGenerateCoverLetter(job)} disabled={generatingId === job.id}>
                {generatingId === job.id ? "Generating..." : "Gen Cover Letter"}
              </Button>
              <Tooltip title={job.favourited ? "Remove from favourites" : "Save to favourites"}>
                <IconButton
                  size="small"
                  onClick={() => handleToggleFavourite(job)}
                  disabled={togglingId === job.id}
                  sx={{ ml: "auto", color: job.favourited ? "warning.main" : "text.secondary" }}
                >
                  {job.favourited ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Open job posting">
                <IconButton size="small" component="a" href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </CardActions>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
