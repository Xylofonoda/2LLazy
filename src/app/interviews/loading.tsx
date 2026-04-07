import { Box, Skeleton, Stack, Grid } from "@mui/material";

export default function InterviewsLoading() {
  return (
    <Box sx={{ p: 3 }}>
      {/* Month navigation skeleton */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Skeleton variant="circular" width={36} height={36} />
        <Skeleton variant="text" width={160} height={32} />
        <Skeleton variant="circular" width={36} height={36} />
      </Stack>

      {/* Calendar grid skeleton — 7 columns */}
      <Grid container spacing={1}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Grid key={i} item xs={12 / 7}>
            <Skeleton variant="text" width="60%" height={20} sx={{ mx: "auto", mb: 1 }} />
          </Grid>
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <Grid key={`cell-${i}`} item xs={12 / 7}>
            <Skeleton variant="rounded" height={80} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
