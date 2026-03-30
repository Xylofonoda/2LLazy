"use client";

import { useActionState, useTransition, useState } from "react";
import {
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import type { UploadedFile } from "@/types";
import { uploadCvAction, deleteUploadedFileAction } from "@/lib/actions/settingsActions";

interface Props {
  uploadedFiles: UploadedFile[];
}

export function CvDocumentsCard({ uploadedFiles }: Props) {
  const [state, formAction, isPending] = useActionState(uploadCvAction, null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [, startDeleteTransition] = useTransition();

  const handleDelete = (id: string) => {
    setDeletingFile(id);
    startDeleteTransition(async () => {
      const result = await deleteUploadedFileAction(id);
      if (result.error) setDeleteError(result.error);
      setDeletingFile(null);
    });
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          CV &amp; Documents
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Upload your CV/resume. Files named <code>cv.*</code> or{" "}
          <code>resume.*</code> are auto-detected for cover letter generation
          and form file uploads.
        </Typography>

        {state?.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {state.error}
          </Alert>
        )}
        {deleteError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDeleteError(null)}>
            {deleteError}
          </Alert>
        )}
        {state?.filename && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Uploaded: {state.filename}
          </Alert>
        )}

        <form action={formAction}>
          <input
            id="cv-upload-input"
            type="file"
            name="file"
            accept=".pdf,.docx,.doc,.txt"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.[0]) {
                e.target.form?.requestSubmit();
              }
            }}
          />
          <Button
            component="label"
            htmlFor="cv-upload-input"
            variant="outlined"
            startIcon={isPending ? <CircularProgress size={16} /> : <UploadFileIcon />}
            disabled={isPending}
            sx={{ mb: 2 }}
          >
            {isPending ? "Uploading..." : "Upload File"}
          </Button>
        </form>

        <Stack spacing={1}>
          {uploadedFiles.map((f) => (
            <Stack key={f.id} direction="row" alignItems="center" spacing={1}>
              <Chip label={f.filename} size="small" variant="outlined" />
              <Typography variant="caption" color="text.secondary">
                {(f.size / 1024).toFixed(1)} KB
              </Typography>
              <Tooltip title="Delete file">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={deletingFile === f.id}
                    onClick={() => handleDelete(f.id)}
                    aria-label={`Delete ${f.filename}`}
                  >
                    {deletingFile === f.id ? (
                      <CircularProgress size={14} color="error" />
                    ) : (
                      <DeleteIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          ))}
          {uploadedFiles.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No files uploaded yet.
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
