"use client";

import {
  Card,
  CardContent,
  Typography,
  Box,
  Stack,
  Switch,
  FormControlLabel,
  Alert,
  Button,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useState, useTransition } from "react";
import { toggleGoogleCalendarSync, checkCalendarAccess } from "@/lib/actions/settingsActions";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

interface Props {
  enabled: boolean;
  hasCalendarAccess: boolean;
}

export function GoogleCalendarCard({ enabled, hasCalendarAccess: initialAccess }: Props) {
  const [syncing, setSyncing] = useState(enabled);
  const [hasAccess, setHasAccess] = useState(initialAccess);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (checked: boolean) => {
    if (checked && !hasAccess) {
      // Need to request calendar scope — redirect to Google incremental auth
      const params = new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
        redirect_uri: `${window.location.origin}/api/auth/callback/google`,
        response_type: "code",
        scope: `openid email profile ${CALENDAR_SCOPE}`,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      return;
    }

    setSyncing(checked);
    setError(null);
    startTransition(async () => {
      try {
        // Recheck access in case it was just granted
        if (checked) {
          const access = await checkCalendarAccess();
          setHasAccess(access);
          if (!access) {
            setSyncing(false);
            setError("Calendar access not yet granted. Use the button below to grant it.");
            return;
          }
        }
        await toggleGoogleCalendarSync(checked);
      } catch {
        setSyncing(!checked);
        setError("Failed to update Google Calendar sync setting.");
      }
    });
  };

  const handleGrantAccess = () => {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
      redirect_uri: `${window.location.origin}/api/auth/callback/google`,
      response_type: "code",
      scope: `openid email profile ${CALENDAR_SCOPE}`,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          <CalendarMonthIcon sx={{ color: "primary.main" }} />
          <Typography variant="h6" sx={{ fontSize: 15, fontWeight: 600 }}>
            Google Calendar Sync
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Automatically mirror your scheduled interviews and calendar events to
          your Google Calendar.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!hasAccess && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button
                size="small"
                color="inherit"
                endIcon={<OpenInNewIcon fontSize="small" />}
                onClick={handleGrantAccess}
              >
                Grant access
              </Button>
            }
          >
            Calendar permission not yet granted.
          </Alert>
        )}

        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={syncing}
                onChange={(e) => handleToggle(e.target.checked)}
                disabled={isPending || !hasAccess}
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                {!hasAccess
                  ? "Grant calendar access first"
                  : syncing
                    ? "Sync enabled"
                    : "Sync disabled"}
              </Typography>
            }
          />
        </Box>

        {syncing && hasAccess && (
          <Alert severity="info" sx={{ mt: 2 }} icon={false}>
            <Typography variant="body2">
              New interviews and events will appear in your Google Calendar.
              Existing entries are synced on the next create or edit.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
