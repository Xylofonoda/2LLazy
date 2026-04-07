import { Box, Skeleton, Stack } from "@mui/material";

export default function FavouritesLoading() {
  return (
    <Box sx={{ p: 3 }}>
      {/* Filter bar skeleton */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Skeleton variant="rounded" width={160} height={40} />
        <Skeleton variant="rounded" width={140} height={40} />
      </Stack>

      {/* Job card skeletons */}
      <Stack spacing={2}>
        {Array.from({ length: 5 }).map((_, i) => (
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
                <Skeleton variant="text" width="45%" height={28} sx={{ mb: 0.5 }} />
                <Skeleton variant="text" width="30%" height={20} sx={{ mb: 1 }} />
                <Skeleton variant="text" width="85%" height={18} sx={{ mb: 0.5 }} />
                <Skeleton variant="text" width="70%" height={18} />
              </Box>
              <Stack spacing={1}>
                <Skeleton variant="rounded" width={130} height={32} />
                <Skeleton variant="rounded" width={130} height={32} />
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
