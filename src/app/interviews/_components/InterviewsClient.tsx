"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  IconButton,
  Button,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import dayjs from "dayjs";
import { ScheduleInterviewDialog } from "@/components/interviews/ScheduleInterviewDialog";
import { InterviewDetailDialog } from "@/components/interviews/InterviewDetailDialog";
import { scheduleInterview } from "@/lib/actions/interviewActions";
import type { Interview, ScheduleInterviewForm } from "@/types";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  initialInterviews: Interview[];
  month: number;
  year: number;
}

export function InterviewsClient({ initialInterviews, month, year }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [detailDialog, setDetailDialog] = useState<Interview | null>(null);
  const [form, setForm] = useState<ScheduleInterviewForm>({
    applicationId: "",
    scheduledAt: dayjs().format("YYYY-MM-DDTHH:mm"),
    durationMinutes: 60,
    notes: "",
  });

  const currentMonth = dayjs(new Date(year, month - 1, 1));
  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfWeek = currentMonth.startOf("month").day();
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

  const interviewsByDay = initialInterviews.reduce<Record<number, Interview[]>>(
    (acc, iv) => {
      const d = dayjs(iv.scheduledAt).date();
      acc[d] = [...(acc[d] ?? []), iv];
      return acc;
    },
    {},
  );

  /** Navigate to a different month via URL search params → triggers RSC re-fetch. */
  const goMonth = (delta: 1 | -1) => {
    const next = currentMonth.add(delta, "month");
    router.push(`/interviews?month=${next.month() + 1}&year=${next.year()}`);
  };

  const handleSchedule = () => {
    startTransition(async () => {
      await scheduleInterview(form);
      router.refresh();
      setScheduleDialog(false);
    });
  };

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h4">Interview Calendar</Typography>
        <Button variant="contained" onClick={() => setScheduleDialog(true)}>
          + Schedule Interview
        </Button>
      </Stack>

      {/* Month nav */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <IconButton onClick={() => goMonth(-1)} disabled={isPending}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" sx={{ minWidth: 160, textAlign: "center" }}>
          {currentMonth.format("MMMM YYYY")}
        </Typography>
        <IconButton onClick={() => goMonth(1)} disabled={isPending}>
          <ChevronRightIcon />
        </IconButton>
      </Stack>

      {/* Calendar grid */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {/* Day headers */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {DAYS_OF_WEEK.map((d) => (
              <Box key={d} sx={{ py: 1, textAlign: "center" }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={600}
                >
                  {d}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Calendar cells */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {Array.from({ length: totalCells }).map((_, idx) => {
              const dayNum = idx - firstDayOfWeek + 1;
              const isCurrentMonth = dayNum > 0 && dayNum <= daysInMonth;
              const today = dayjs();
              const isToday =
                isCurrentMonth &&
                currentMonth.date(dayNum).isSame(today, "day");
              const dayInterviews = isCurrentMonth
                ? (interviewsByDay[dayNum] ?? [])
                : [];

              return (
                <Box
                  key={idx}
                  sx={{
                    minHeight: 80,
                    p: 0.5,
                    borderRight: "1px solid rgba(255,255,255,0.04)",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: isCurrentMonth ? "pointer" : "default",
                    "&:hover": isCurrentMonth
                      ? { bgcolor: "rgba(99,102,241,0.08)" }
                      : {},
                  }}
                >
                  {isCurrentMonth && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        textAlign: "right",
                        fontWeight: isToday ? 700 : 400,
                        color: isToday ? "primary.main" : "text.secondary",
                        mb: 0.5,
                      }}
                    >
                      {dayNum}
                    </Typography>
                  )}
                  <Stack spacing={0.5}>
                    {dayInterviews.map((iv) => (
                      <Chip
                        key={iv.id}
                        label={`${dayjs(iv.scheduledAt).format("HH:mm")} ${iv.application.job.company}`}
                        size="small"
                        color="success"
                        sx={{ fontSize: 10, height: 20, cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailDialog(iv);
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      <ScheduleInterviewDialog
        open={scheduleDialog}
        form={form}
        onChange={setForm}
        onClose={() => setScheduleDialog(false)}
        onSubmit={handleSchedule}
      />

      <InterviewDetailDialog
        interview={detailDialog}
        onClose={() => setDetailDialog(null)}
      />
    </Box>
  );
}
