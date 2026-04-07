import { Box, Typography } from "@mui/material";
import { AiStatusCard } from "./AiStatusCard";
import { UserProfileCard } from "./UserProfileCard";
import { CvDocumentsCard } from "./CvDocumentsCard";
import { SiteCredentialsCard } from "./SiteCredentialsCard";
import type { SiteCredStatus, UploadedFile, UserProfile } from "@/types";

interface Props {
  credentials: SiteCredStatus[];
  profile: UserProfile;
  uploadedFiles: UploadedFile[];
  aiHealth: { ok: boolean; missing: string[] };
  hasOpenAI: boolean;
}

export function SettingsClient({
  credentials,
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
      <SiteCredentialsCard credentials={credentials} />
    </Box>
  );
}
