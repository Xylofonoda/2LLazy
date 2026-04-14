import { Box, Typography } from "@mui/material";
import { AiStatusCard } from "./AiStatusCard";
import { UserProfileCard } from "./UserProfileCard";
import { CvDocumentsCard } from "./CvDocumentsCard";
import { GoogleCalendarCard } from "./GoogleCalendarCard";
import type { UploadedFile, UserProfile } from "@/types";

interface Props {
  profile: UserProfile;
  uploadedFiles: UploadedFile[];
  aiHealth: { ok: boolean; missing: string[] };
  hasOpenAI: boolean;
  hasCalendarAccess: boolean;
}

export function SettingsClient({
  profile,
  uploadedFiles,
  aiHealth,
  hasOpenAI,
  hasCalendarAccess,
}: Props) {
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 0.5 }}>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure your profile, CV documents, and AI integrations.
        </Typography>
      </Box>
      <AiStatusCard hasOpenAI={hasOpenAI} aiHealth={aiHealth} />
      <GoogleCalendarCard enabled={profile.googleCalendarSync} hasCalendarAccess={hasCalendarAccess} />
      <UserProfileCard profile={profile} />
      <CvDocumentsCard uploadedFiles={uploadedFiles} />
    </Box>
  );
}
