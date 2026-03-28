"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { saveUserProfile } from "@/lib/actions/settingsActions";
import type { UserProfile } from "@/types";

const LANGUAGES = [
  "English",
  "Dutch",
  "French",
  "German",
  "Spanish",
  "Portuguese",
  "Italian",
  "Polish",
  "Czech",
  "Swedish",
  "Danish",
  "Norwegian",
] as const;

interface Props {
  profile: UserProfile;
}

export function UserProfileCard({ profile: initialProfile }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSave = () => {
    setSaving(true);
    startTransition(async () => {
      try {
        await saveUserProfile(profile);
        showMessage("success", "Profile saved.");
        router.refresh();
      } catch (err) {
        showMessage("error", String(err));
      } finally {
        setSaving(false);
      }
    });
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Your Profile
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Used to fill application forms automatically.
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Full Name"
              size="small"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Email"
              size="small"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Phone"
              size="small"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              fullWidth
            />
            <TextField
              label="LinkedIn URL"
              size="small"
              value={profile.linkedInUrl}
              onChange={(e) => setProfile({ ...profile, linkedInUrl: e.target.value })}
              fullWidth
            />
          </Stack>
          <TextField
            label="GitHub URL"
            size="small"
            value={profile.githubUrl}
            onChange={(e) => setProfile({ ...profile, githubUrl: e.target.value })}
            sx={{ maxWidth: 400 }}
          />
          <FormControl size="small" sx={{ maxWidth: 260 }}>
            <InputLabel id="cl-lang-label">Cover Letter Language</InputLabel>
            <Select
              labelId="cl-lang-label"
              label="Cover Letter Language"
              value={profile.coverLetterLanguage}
              onChange={(e) => setProfile({ ...profile, coverLetterLanguage: e.target.value })}
            >
              {LANGUAGES.map((lang) => (
                <MenuItem key={lang} value={lang}>
                  {lang}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{ alignSelf: "flex-start" }}
          >
            {saving ? <CircularProgress size={18} /> : "Save Profile"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
