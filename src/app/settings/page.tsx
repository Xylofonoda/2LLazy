"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Chip,
  Alert,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

type SiteName = "LINKEDIN" | "INDEED";

interface SiteCredStatus {
  site: SiteName;
  configured: boolean;
  username: string | null;
}

interface UploadedFile {
  filename: string;
  size: number;
  uploadedAt: string;
}

const SITE_LABELS: Record<SiteName, string> = {
  LINKEDIN: "LinkedIn",
  INDEED: "Indeed",
};

export default function SettingsPage() {
  const [credentials, setCredentials] = useState<SiteCredStatus[]>([]);
  const [credForms, setCredForms] = useState<Record<SiteName, { username: string; password: string }>>({
    LINKEDIN: { username: "", password: "" },
    INDEED: { username: "", password: "" },
  });
  const [savingCred, setSavingCred] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<{ type: "success" | "error"; text: string }[]>([]);
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", linkedInUrl: "", githubUrl: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [ollamaOk, setOllamaOk] = useState<{ ok: boolean; missing: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addMessage = (type: "success" | "error", text: string) => {
    setMessages((prev) => [...prev, { type, text }]);
    setTimeout(() => setMessages((prev) => prev.slice(1)), 5000);
  };

  const fetchAll = async () => {
    const [credRes, fileRes, profileRes, healthRes] = await Promise.all([
      fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query { getSiteCredentials { site configured username } }`,
        }),
      }),
      fetch("/api/uploads"),
      fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `query { getUserProfile { name email phone linkedInUrl githubUrl } }` }),
      }),
      fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `query { ollamaHealth { ok missing } }` }),
      }),
    ]);

    const credData = await credRes.json();
    setCredentials(credData.data?.getSiteCredentials ?? []);

    const fileData = await fileRes.json();
    setUploadedFiles(fileData.files ?? []);

    const profileData = await profileRes.json();
    if (profileData.data?.getUserProfile) {
      setProfile(profileData.data.getUserProfile);
    }

    const healthData = await healthRes.json();
    setOllamaOk(healthData.data?.ollamaHealth ?? null);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSaveCredentials = async (site: SiteName) => {
    setSavingCred(site);
    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation SaveCred($site: SiteName!, $username: String!, $password: String!) {
            saveSiteCredentials(site: $site, username: $username, password: $password) { site configured }
          }`,
          variables: { site, ...credForms[site] },
        }),
      });
      const data = await res.json();
      if (data.errors) throw new Error(data.errors[0].message);
      addMessage("success", `${SITE_LABELS[site]} credentials saved.`);
      setCredForms((prev) => ({ ...prev, [site]: { username: "", password: "" } }));
      await fetchAll();
    } catch (err) {
      addMessage("error", `Failed to save ${SITE_LABELS[site]}: ${String(err)}`);
    } finally {
      setSavingCred(null);
    }
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
      addMessage("success", `Uploaded: ${data.filename}`);
      await fetchAll();
    } catch (err) {
      addMessage("error", String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation SaveProfile($name: String!, $email: String!, $phone: String, $linkedInUrl: String, $githubUrl: String) {
            saveUserProfile(name: $name, email: $email, phone: $phone, linkedInUrl: $linkedInUrl, githubUrl: $githubUrl) { id }
          }`,
          variables: profile,
        }),
      });
      const data = await res.json();
      if (data.errors) throw new Error(data.errors[0].message);
      addMessage("success", "Profile saved.");
    } catch (err) {
      addMessage("error", String(err));
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Settings</Typography>

      {messages.map((m, i) => (
        <Alert key={i} severity={m.type} sx={{ mb: 1 }}>{m.text}</Alert>
      ))}

      {/* Ollama Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>AI Status (Ollama)</Typography>
          {ollamaOk ? (
            ollamaOk.ok ? (
              <Chip icon={<CheckCircleIcon />} label="Ollama running — all models available" color="success" />
            ) : (
              <Stack spacing={1}>
                <Chip icon={<ErrorIcon />} label="Ollama issue detected" color="error" />
                {ollamaOk.missing.map((m) => (
                  <Alert key={m} severity="warning" sx={{ py: 0 }}>
                    Missing model: <strong>{m}</strong> — run <code>ollama pull {m}</code>
                  </Alert>
                ))}
              </Stack>
            )
          ) : (
            <Typography color="text.secondary" variant="body2">Checking Ollama...</Typography>
          )}
        </CardContent>
      </Card>

      {/* User Profile */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Your Profile</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Used to fill application forms automatically.
          </Typography>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Full Name" size="small" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} fullWidth />
              <TextField label="Email" size="small" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Phone" size="small" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} fullWidth />
              <TextField label="LinkedIn URL" size="small" value={profile.linkedInUrl} onChange={(e) => setProfile({ ...profile, linkedInUrl: e.target.value })} fullWidth />
            </Stack>
            <TextField label="GitHub URL" size="small" value={profile.githubUrl} onChange={(e) => setProfile({ ...profile, githubUrl: e.target.value })} sx={{ maxWidth: 400 }} />
            <Button variant="contained" onClick={handleSaveProfile} disabled={savingProfile} sx={{ alignSelf: "flex-start" }}>
              {savingProfile ? <CircularProgress size={18} /> : "Save Profile"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* CV Upload */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>CV &amp; Documents</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload your CV/resume. Files named <code>cv.*</code> or <code>resume.*</code> are auto-detected for cover letter generation and form file uploads.
          </Typography>

          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
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
              <Typography variant="body2" color="text.secondary">No files uploaded yet.</Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Site Credentials */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Site Credentials</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Passwords are encrypted with AES-256-GCM before storage and never returned by any API. Used for sites that require login to scrape or apply.
          </Typography>

          <Stack spacing={3} divider={<Divider />}>
            {(["LINKEDIN", "INDEED"] as SiteName[]).map((site) => {
              const status = credentials.find((c) => c.site === site);
              return (
                <Box key={site}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle2">{SITE_LABELS[site]}</Typography>
                    {status?.configured ? (
                      <Chip icon={<CheckCircleIcon />} label={`Saved (${status.username})`} size="small" color="success" />
                    ) : (
                      <Chip label="Not configured" size="small" color="default" variant="outlined" />
                    )}
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-end">
                    <TextField
                      label="Username / Email"
                      size="small"
                      value={credForms[site].username}
                      onChange={(e) => setCredForms((prev) => ({ ...prev, [site]: { ...prev[site], username: e.target.value } }))}
                      sx={{ maxWidth: 260 }}
                    />
                    <TextField
                      label="Password"
                      size="small"
                      type="password"
                      value={credForms[site].password}
                      onChange={(e) => setCredForms((prev) => ({ ...prev, [site]: { ...prev[site], password: e.target.value } }))}
                      sx={{ maxWidth: 260 }}
                      InputProps={{
                        endAdornment: (
                          <Tooltip title="Password is encrypted before storage">
                            <VisibilityOffIcon fontSize="small" sx={{ color: "text.secondary", mr: -0.5 }} />
                          </Tooltip>
                        ),
                      }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      disabled={savingCred === site || !credForms[site].username || !credForms[site].password}
                      onClick={() => handleSaveCredentials(site)}
                    >
                      {savingCred === site ? <CircularProgress size={16} /> : "Save"}
                    </Button>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
