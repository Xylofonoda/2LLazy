import { Box, Stack, Skeleton } from "@mui/material";

export default function DashboardLoading() {
  return (
    <Box>
      <Skeleton variant="text" width={180} height={42} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width={280} height={20} sx={{ mb: 3 }} />
      <Skeleton variant="rectangular" height={52} sx={{ borderRadius: 2, mb: 2 }} />
      <Stack spacing={2}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
        ))}
      </Stack>
    </Box>
  );
}
