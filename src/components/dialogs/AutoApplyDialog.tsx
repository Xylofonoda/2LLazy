"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import StopIcon from "@mui/icons-material/Stop";
import type { Application } from "@/types";
import { getCoverLettersForJob } from "@/lib/actions/applicationActions";

type CoverLetter = {
  id: string;
  content: string;
  generatedByAI: boolean;
};

interface AutoApplyDialogProps {
  application: Application;
  open: boolean;
  onClose: () => void;
}

/**
 * Confirmation dialog that lets the user pick a cover letter then triggers
 * the AI-powered auto-apply pipeline via POST /api/apply.
 *
 * While applying, a "Stop" button aborts the HTTP request so the user is
 * never locked in. The server has a 120s hard timeout as a backstop.
 */
export function AutoApplyDialog({ application, open, onClose }: AutoApplyDialogProps) {
  const router = useRouter();
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loadingLetters, setLoadingLetters] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingLetters(true);
    setError(null);
    getCoverLettersForJob(application.job.id)
      .then((letters) => {
        setCoverLetters(letters);
        if (letters.length > 0) setSelectedId(letters[0].id);
        else setSelectedId("");
      })
      .catch(() => setError("Failed to load cover letters."))
      .finally(() => setLoadingLetters(false));
  }, [open, application.job.id]);

  // Clean up any in-flight request when the dialog is closed externally
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setApplying(false);
    }
  }, [open]);

  const handleApply = async () => {
    setApplying(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: application.id,
          coverLetterId: selectedId || null,
        }),
        signal: controller.signal,
      });

      const data: {
        success?: boolean;
        manual?: boolean;
        url?: string;
        errorMessage?: string;
      } = await res.json();

      if (data.success) {
        router.refresh();
        onClose();
      } else if (data.manual) {
        // Visible browser opened on the server — inform and close
        router.refresh();
        onClose();
      } else {
        setError(data.errorMessage ?? "Application failed. You can try again or apply manually.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User stopped the request — close silently
        onClose();
        return;
      }
      setError("Network error — please try again.");
    } finally {
      abortRef.current = null;
      setApplying(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  return (
    <Dialog open={open} onClose={applying ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Auto Apply</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          {application.job.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {application.job.company}
          {application.job.location ? ` · ${application.job.location}` : ""}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loadingLetters ? (
          <CircularProgress size={24} />
        ) : coverLetters.length === 0 ? (
          <Alert severity="info">
            No cover letters found for this job. You can still apply without one, or generate a
            cover letter first.
          </Alert>
        ) : (
          <FormControl fullWidth size="small">
            <InputLabel>Cover Letter</InputLabel>
            <Select
              value={selectedId}
              label="Cover Letter"
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {coverLetters.map((cl) => (
                <MenuItem key={cl.id} value={cl.id}>
                  {cl.generatedByAI ? "AI Generated" : "Custom"} —{" "}
                  {cl.content.slice(0, 60)}…
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>

      <DialogActions>
        {applying ? (
          <Button
            color="error"
            startIcon={<StopIcon />}
            onClick={handleStop}
          >
            Stop
          </Button>
        ) : (
          <Button onClick={onClose}>Cancel</Button>
        )}
        <Button
          variant="contained"
          startIcon={
            applying ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchIcon />
          }
          onClick={handleApply}
          disabled={applying || loadingLetters}
        >
          {applying ? "Applying…" : "Apply Now"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
