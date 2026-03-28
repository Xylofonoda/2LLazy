"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";

interface CoverLetterDialogProps {
  open: boolean;
  content: string;
  filename?: string;
  onClose: () => void;
}

/** Dialog that displays a generated cover letter with a download option. */
export function CoverLetterDialog({
  open,
  content,
  filename = "cover-letter.txt",
  onClose,
}: CoverLetterDialogProps) {
  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Cover Letter</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
          {content}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button startIcon={<DownloadIcon />} onClick={handleDownload}>
          Download .txt
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
