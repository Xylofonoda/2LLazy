import { Box, Skeleton, Stack } from "@mui/material";

export default function DashboardLoading() {
  return (
    <Box sx={{ p: 3 }}>
      {/* Filter bar skeleton */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Skeleton variant="rounded" width={120} height={40} />
        <Skeleton variant="rounded" width={160} height={40} />
        <Skeleton variant="rounded" width={140} height={40} />
      </Stack>

      {/* Status chip row skeleton */}
      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width={90} height={32} />
        ))}
      </Stack>

      {/* Application card skeletons */}
      <Stack spacing={2}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              p: 2.5,
              borderRadius: 2,
              border: "1px solid rgba(255,255,255,0.06)",
              bgcolor: "background.paper",
            }}
          >
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="40%" height={28} sx={{ mb: 0.5 }} />
                <Skeleton variant="text" width="25%" height={20} sx={{ mb: 1 }} />
                <Stack direction="row" spacing={1}>
                  <Skeleton variant="rounded" width={80} height={24} />
                  <Skeleton variant="rounded" width={100} height={24} />
                </Stack>
              </Box>
              <Skeleton variant="rounded" width={110} height={32} />
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
