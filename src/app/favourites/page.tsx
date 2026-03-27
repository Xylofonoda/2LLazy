"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Chip,
  Stack,
  Alert,
  Button,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress,
} from "@mui/material";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import SendIcon from "@mui/icons-material/Send";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
  source: string;
  salary?: string;
  favourited: boolean;
}

const SOURCE_COLOR: Record<string, "primary" | "secondary" | "success" | "warning" | "info" | "error"> = {
  LINKEDIN: "primary",
  INDEED: "info",
  STARTUPJOBS: "success",
  JOBSTACK: "warning",
};

export default function FavouritesPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const fetchFavourites = useCallback(async () => {
    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query {
            getFavourites {
              id title company location description sourceUrl source salary favourited
            }
          }`,
        }),
      });
      const data = await res.json();
      setJobs(data.data?.getFavourites ?? []);
    } catch (err) {
      setErrors([`Failed to load favourites: ${String(err)}`]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavourites();
  }, [fetchFavourites]);

  const handleRemoveFavourite = async (job: JobPosting) => {
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
      // Remove from the list since it's no longer favourited
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } catch (err) {
      setErrors((prev) => [...prev, `Failed: ${String(err)}`]);
    } finally {
      setTogglingId(null);
    }
  };

  const handleApply = async (job: JobPosting) => {
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

  const handleGenerateCoverLetter = async (job: JobPosting) => {
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
        Favourites
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Jobs you&apos;ve saved. Apply or generate a cover letter when you&apos;re ready.
      </Typography>

      {errors.map((e, i) => (
        <Alert key={i} severity="warning" sx={{ mb: 1 }} onClose={() => setErrors((prev) => prev.filter((_, j) => j !== i))}>
          {e}
        </Alert>
      ))}

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && jobs.length === 0 && (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
          No favourites yet. Search for jobs and click the bookmark icon to save them here.
        </Typography>
      )}

      <Stack spacing={2}>
        {jobs.map((job) => (
          <Card key={job.id}>
            <CardContent sx={{ pb: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="h6" sx={{ fontSize: 16 }}>{job.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{job.company} · {job.location}</Typography>
                </Box>
                <Chip
                  label={job.source}
                  size="small"
                  color={SOURCE_COLOR[job.source] ?? "default"}
                  variant="outlined"
                />
              </Stack>
              {job.salary && (
                <Typography variant="body2" color="success.main" sx={{ mt: 0.5 }}>{job.salary}</Typography>
              )}
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
              <Tooltip title="Remove from favourites">
                <IconButton
                  size="small"
                  onClick={() => handleRemoveFavourite(job)}
                  disabled={togglingId === job.id}
                  sx={{ ml: "auto", color: "warning.main" }}
                >
                  {togglingId === job.id
                    ? <CircularProgress size={16} />
                    : <BookmarkIcon fontSize="small" />}
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
