import { Box, Skeleton, Stack, Divider } from "@mui/material";

export default function SettingsLoading() {
  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      {/* Section heading */}
      <Skeleton variant="text" width={200} height={32} sx={{ mb: 3 }} />

      {/* Profile fields */}
      <Stack spacing={2} sx={{ mb: 4 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={56} />
        ))}
      </Stack>

      <Divider sx={{ my: 3 }} />

      {/* CV uploads section */}
      <Skeleton variant="text" width={160} height={28} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" height={100} sx={{ mb: 2 }} />
      <Stack spacing={1}>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={48} />
        ))}
      </Stack>
    </Box>
  );
}
