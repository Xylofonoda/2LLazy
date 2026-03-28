"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
} from "@mui/material";
import type { ScheduleInterviewForm } from "@/types";

interface ScheduleInterviewDialogProps {
  open: boolean;
  form: ScheduleInterviewForm;
  onChange: (form: ScheduleInterviewForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}

/** Dialog for scheduling a new interview against an existing application. */
export function ScheduleInterviewDialog({
  open,
  form,
  onChange,
  onClose,
  onSubmit,
}: ScheduleInterviewDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Schedule Interview</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Application ID"
            size="small"
            value={form.applicationId}
            onChange={(e) =>
              onChange({ ...form, applicationId: e.target.value })
            }
            helperText="Paste the application ID from the dashboard"
            fullWidth
          />
          <TextField
            label="Date &amp; Time"
            type="datetime-local"
            size="small"
            value={form.scheduledAt}
            onChange={(e) =>
              onChange({ ...form, scheduledAt: e.target.value })
            }
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Duration (minutes)"
            type="number"
            size="small"
            value={form.durationMinutes}
            onChange={(e) =>
              onChange({ ...form, durationMinutes: Number(e.target.value) })
            }
            fullWidth
          />
          <TextField
            label="Notes"
            size="small"
            multiline
            rows={3}
            value={form.notes}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={!form.applicationId || !form.scheduledAt}
        >
          Schedule
        </Button>
      </DialogActions>
    </Dialog>
  );
}
