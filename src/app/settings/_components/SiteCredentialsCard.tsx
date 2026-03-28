"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Alert,
  Chip,
  Divider,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { saveSiteCredentials, clearSiteCredentials } from "@/lib/actions/settingsActions";
import type { SiteCredStatus } from "@/types";

type SiteName = "LINKEDIN";

const SITE_LABELS: Record<SiteName, string> = {
  LINKEDIN: "LinkedIn",
};

interface Props {
  credentials: SiteCredStatus[];
}

export function SiteCredentialsCard({ credentials }: Props) {
  const router = useRouter();

  const [credForms, setCredForms] = useState<
    Record<SiteName, { username: string; password: string }>
  >({ LINKEDIN: { username: "", password: "" } });
  const [savingCred, setSavingCred] = useState<string | null>(null);
  const [clearingCred, setClearingCred] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSave = async (site: SiteName) => {
    setSavingCred(site);
    try {
      await saveSiteCredentials(site, credForms[site].username, credForms[site].password);
      showMessage("success", `${SITE_LABELS[site]} credentials saved.`);
      setCredForms((prev) => ({ ...prev, [site]: { username: "", password: "" } }));
      router.refresh();
    } catch (err) {
      showMessage("error", `Failed to save ${SITE_LABELS[site]}: ${String(err)}`);
    } finally {
      setSavingCred(null);
    }
  };

  const handleClear = async (site: SiteName) => {
    setClearingCred(site);
    try {
      await clearSiteCredentials(site);
      showMessage("success", `${SITE_LABELS[site]} session cleared.`);
      router.refresh();
    } catch (err) {
      showMessage("error", `Failed to log out of ${SITE_LABELS[site]}: ${String(err)}`);
    } finally {
      setClearingCred(null);
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Site Credentials
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Passwords are encrypted with AES-256-GCM before storage and never
          returned by any API.
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        <Stack spacing={3} divider={<Divider />}>
          {(["LINKEDIN"] as SiteName[]).map((site) => {
            const status = credentials.find((c) => c.site === site);
            return (
              <Box key={site}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle2">{SITE_LABELS[site]}</Typography>
                  {status?.configured ? (
                    <Chip
                      icon={<CheckCircleIcon />}
                      label={`Saved (${status.username})`}
                      size="small"
                      color="success"
                    />
                  ) : (
                    <Chip label="Not configured" size="small" color="default" variant="outlined" />
                  )}
                  {status?.configured && (
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      disabled={clearingCred === site}
                      onClick={() => handleClear(site)}
                      sx={{ ml: "auto" }}
                    >
                      {clearingCred === site ? <CircularProgress size={14} /> : "Log Out"}
                    </Button>
                  )}
                </Stack>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems="flex-end"
                >
                  <TextField
                    label="Username / Email"
                    size="small"
                    value={credForms[site].username}
                    onChange={(e) =>
                      setCredForms((prev) => ({
                        ...prev,
                        [site]: { ...prev[site], username: e.target.value },
                      }))
                    }
                    sx={{ maxWidth: 260 }}
                  />
                  <TextField
                    label="Password"
                    size="small"
                    type="password"
                    value={credForms[site].password}
                    onChange={(e) =>
                      setCredForms((prev) => ({
                        ...prev,
                        [site]: { ...prev[site], password: e.target.value },
                      }))
                    }
                    sx={{ maxWidth: 260 }}
                    InputProps={{
                      endAdornment: (
                        <Tooltip title="Password is encrypted before storage">
                          <VisibilityOffIcon
                            fontSize="small"
                            sx={{ color: "text.secondary", mr: -0.5 }}
                          />
                        </Tooltip>
                      ),
                    }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    disabled={
                      savingCred === site ||
                      !credForms[site].username ||
                      !credForms[site].password
                    }
                    onClick={() => handleSave(site)}
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
  );
}
