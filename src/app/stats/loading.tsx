import { Box, Skeleton, Stack } from "@mui/material";

export default function StatsLoading() {
  return (
    <Box>
      <Skeleton variant="text" width={200} height={40} sx={{ mb: 1 }} />
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rectangular" height={100} sx={{ flex: 1, borderRadius: 2 }} />
        ))}
      </Stack>
      <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2, mb: 2 }} />
      <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
    </Box>
  );
}
