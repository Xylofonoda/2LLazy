"use client";

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
} from "@mui/material";
import type { AppStatus } from "@/types";
import { ALL_STATUSES } from "@/types";

interface StatusChangeDialogProps {
  open: boolean;
  /** The currently selected (pending) status value. */
  status: AppStatus;
  isSaving?: boolean;
  onStatusChange: (status: AppStatus) => void;
  onClose: () => void;
  onSave: () => void;
}

/** Dialog that lets the user pick a new application status. */
export function StatusChangeDialog({
  open,
  status,
  isSaving,
  onStatusChange,
  onClose,
  onSave,
}: StatusChangeDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Update Status</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Status</InputLabel>
          <Select
            value={status}
            label="Status"
            onChange={(e) => onStatusChange(e.target.value as AppStatus)}
          >
            {ALL_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={isSaving} onClick={onSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
