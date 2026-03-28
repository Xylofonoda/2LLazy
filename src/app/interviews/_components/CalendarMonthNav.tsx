import { Stack, Typography, IconButton } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { Dayjs } from "dayjs";

interface Props {
  currentMonth: Dayjs;
  isPending: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function CalendarMonthNav({ currentMonth, isPending, onPrev, onNext }: Props) {
  return (
    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
      <IconButton onClick={onPrev} disabled={isPending}>
        <ChevronLeftIcon />
      </IconButton>
      <Typography variant="h6" sx={{ minWidth: 160, textAlign: "center" }}>
        {currentMonth.format("MMMM YYYY")}
      </Typography>
      <IconButton onClick={onNext} disabled={isPending}>
        <ChevronRightIcon />
      </IconButton>
    </Stack>
  );
}
