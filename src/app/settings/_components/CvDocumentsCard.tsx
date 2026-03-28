"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  Chip,
  CircularProgress,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { UploadedFile } from "@/types";

interface Props {
  uploadedFiles: UploadedFile[];
}

export function CvDocumentsCard({ uploadedFiles }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showMessage("success", `Uploaded: ${data.filename}`);
      router.refresh();
    } catch (err) {
      showMessage("error", String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
        <Button
          variant="outlined"
          startIcon={uploading ? <CircularProgress size={16} /> : <UploadFileIcon />}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          sx={{ mb: 2 }}
        >
          {uploading ? "Uploading..." : "Upload File"}
        </Button>

        <Stack spacing={1}>
          {uploadedFiles.map((f) => (
            <Stack key={f.filename} direction="row" alignItems="center" spacing={1}>
              <Chip label={f.filename} size="small" variant="outlined" />
              <Typography variant="caption" color="text.secondary">
                {(f.size / 1024).toFixed(1)} KB
              </Typography>
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
