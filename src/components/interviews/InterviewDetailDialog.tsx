"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import type { Interview } from "@/types";

interface InterviewDetailDialogProps {
  interview: Interview | null;
  onClose: () => void;
}

/** Read-only dialog showing full details for a single interview. */
export function InterviewDetailDialog({
  interview,
  onClose,
}: InterviewDetailDialogProps) {
  if (!interview) return null;

  return (
    <Dialog open={!!interview} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Interview — {interview.application.job.title}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Typography variant="body2">
            <strong>Company:</strong> {interview.application.job.company}
          </Typography>
          <Typography variant="body2">
            <strong>When:</strong>{" "}
            {dayjs(interview.scheduledAt).format(
              "dddd, MMMM D YYYY [at] HH:mm",
            )}
          </Typography>
          <Typography variant="body2">
            <strong>Duration:</strong> {interview.durationMinutes} min
          </Typography>
          {interview.notes && (
            <Typography variant="body2">
              <strong>Notes:</strong> {interview.notes}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            Application ID: {interview.application.id}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
