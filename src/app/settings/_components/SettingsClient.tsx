import { Box, Typography } from "@mui/material";
import { AiStatusCard } from "./AiStatusCard";
import { UserProfileCard } from "./UserProfileCard";
import { CvDocumentsCard } from "./CvDocumentsCard";
import type { UploadedFile, UserProfile } from "@/types";

interface Props {
  profile: UserProfile;
  uploadedFiles: UploadedFile[];
  aiHealth: { ok: boolean; missing: string[] };
  hasOpenAI: boolean;
}

export function SettingsClient({
  profile,
  uploadedFiles,
  aiHealth,
  hasOpenAI,
}: Props) {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <AiStatusCard hasOpenAI={hasOpenAI} aiHealth={aiHealth} />
      <UserProfileCard profile={profile} />
      <CvDocumentsCard uploadedFiles={uploadedFiles} />
    </Box>
  );
}
