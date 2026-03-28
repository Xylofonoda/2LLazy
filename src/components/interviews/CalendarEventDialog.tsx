"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  CircularProgress,
} from "@mui/material";
import type { CalendarEventForm } from "@/types";

interface Props {
  open: boolean;
  form: CalendarEventForm;
  editId: string | null;
  isSaving: boolean;
  onChange: (form: CalendarEventForm) => void;
  onClose: () => void;
  onSubmit: () => void;
  onDelete?: () => void;
}

export function CalendarEventDialog({
  open,
  form,
  editId,
  isSaving,
  onChange,
  onClose,
  onSubmit,
  onDelete,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editId ? "Edit Event" : "New Calendar Event"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Title"
            size="small"
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
            placeholder="e.g. Interview prep, Networking call, HR screening"
            fullWidth
            autoFocus
          />
          <TextField
            label="Date & Time"
            type="datetime-local"
            size="small"
            value={form.scheduledAt}
            onChange={(e) => onChange({ ...form, scheduledAt: e.target.value })}
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
            inputProps={{ min: 5 }}
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
      <DialogActions
        sx={{ justifyContent: editId && onDelete ? "space-between" : "flex-end" }}
      >
        {editId && onDelete && (
          <Button color="error" onClick={onDelete} disabled={isSaving}>
            {isSaving ? <CircularProgress size={14} /> : "Delete"}
          </Button>
        )}
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={onSubmit}
            disabled={!form.title.trim() || !form.scheduledAt || isSaving}
          >
            {isSaving ? <CircularProgress size={16} /> : editId ? "Save" : "Create"}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
