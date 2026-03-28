"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Chip,
} from "@mui/material";
import dayjs from "dayjs";
import type { CalendarEntry } from "@/types";

interface Props {
  entry: CalendarEntry | null;
  onClose: () => void;
  onEdit?: (entry: CalendarEntry) => void;
}

export function InterviewDetailDialog({ entry, onClose, onEdit }: Props) {
  if (!entry) return null;

  return (
    <Dialog open={!!entry} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        {entry.title}
        <Chip
          label={entry.type === "interview" ? "Interview" : "Event"}
          size="small"
          color={entry.type === "interview" ? "success" : "primary"}
          sx={{ ml: 1 }}
        />
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {entry.subtitle && (
            <Typography variant="body2">
              <strong>Position:</strong> {entry.subtitle}
            </Typography>
          )}
          <Typography variant="body2">
            <strong>When:</strong>{" "}
            {dayjs(entry.scheduledAt).format("dddd, MMMM D YYYY [at] HH:mm")}
          </Typography>
          <Typography variant="body2">
            <strong>Duration:</strong> {entry.durationMinutes} min
          </Typography>
          {entry.notes && (
            <Typography variant="body2">
              <strong>Notes:</strong> {entry.notes}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {entry.type === "event" && onEdit && (
          <Button variant="outlined" onClick={() => onEdit(entry)}>
            Edit
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
