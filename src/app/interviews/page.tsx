"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Chip,
  IconButton,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import dayjs from "dayjs";

interface Interview {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
  notes: string | null;
  application: {
    id: string;
    job: { title: string; company: string };
  };
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function InterviewsPage() {
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [detailDialog, setDetailDialog] = useState<Interview | null>(null);

  // Form state for scheduling
  const [form, setForm] = useState({
    applicationId: "",
    scheduledAt: dayjs().format("YYYY-MM-DDTHH:mm"),
    durationMinutes: 60,
    notes: "",
  });

  const fetchInterviews = async () => {
    const res = await fetch("/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query GetInt($month: Int!, $year: Int!) {
          getInterviews(month: $month, year: $year) {
            id scheduledAt durationMinutes timezone notes
            application { id job { title company } }
          }
        }`,
        variables: { month: currentMonth.month() + 1, year: currentMonth.year() },
      }),
    });
    const data = await res.json();
    setInterviews(data.data?.getInterviews ?? []);
  };

  useEffect(() => { fetchInterviews(); }, [currentMonth]);

  const interviewsByDay = interviews.reduce<Record<number, Interview[]>>((acc, iv) => {
    const d = dayjs(iv.scheduledAt).date();
    acc[d] = [...(acc[d] ?? []), iv];
    return acc;
  }, {});

  const startOfMonth = currentMonth.startOf("month");
  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfWeek = startOfMonth.day();
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

  const handleSchedule = async () => {
    await fetch("/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation SchedInt($applicationId: ID!, $scheduledAt: String!, $durationMinutes: Int, $notes: String) {
          scheduleInterview(applicationId: $applicationId, scheduledAt: $scheduledAt, durationMinutes: $durationMinutes, notes: $notes) {
            id scheduledAt
          }
        }`,
        variables: form,
      }),
    });
    setScheduleDialog(false);
    fetchInterviews();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Interview Calendar</Typography>
        <Button variant="contained" onClick={() => setScheduleDialog(true)}>
          + Schedule Interview
        </Button>
      </Stack>

      {/* Month nav */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <IconButton onClick={() => setCurrentMonth((m) => m.subtract(1, "month"))}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" sx={{ minWidth: 160, textAlign: "center" }}>
          {currentMonth.format("MMMM YYYY")}
        </Typography>
        <IconButton onClick={() => setCurrentMonth((m) => m.add(1, "month"))}>
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
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
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
              const isToday = isCurrentMonth && currentMonth.date(dayNum).isSame(today, "day");
              const dayInterviews = isCurrentMonth ? (interviewsByDay[dayNum] ?? []) : [];

              return (
                <Box
                  key={idx}
                  sx={{
                    minHeight: 80,
                    p: 0.5,
                    borderRight: "1px solid rgba(255,255,255,0.04)",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: isCurrentMonth ? "pointer" : "default",
                    "&:hover": isCurrentMonth ? { bgcolor: "rgba(99,102,241,0.08)" } : {},
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
                        onClick={(e) => { e.stopPropagation(); setDetailDialog(iv); }}
                      />
                    ))}
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {/* Schedule Interview Dialog */}
      <Dialog open={scheduleDialog} onClose={() => setScheduleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Schedule Interview</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Application ID"
              size="small"
              value={form.applicationId}
              onChange={(e) => setForm({ ...form, applicationId: e.target.value })}
              helperText="Paste the application ID from the dashboard"
              fullWidth
            />
            <TextField
              label="Date &amp; Time"
              type="datetime-local"
              size="small"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Duration (minutes)"
              type="number"
              size="small"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
              fullWidth
            />
            <TextField
              label="Notes"
              size="small"
              multiline
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSchedule} disabled={!form.applicationId || !form.scheduledAt}>
            Schedule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Interview Detail Dialog */}
      {detailDialog && (
        <Dialog open={!!detailDialog} onClose={() => setDetailDialog(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Interview — {detailDialog.application.job.title}</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Company:</strong> {detailDialog.application.job.company}
              </Typography>
              <Typography variant="body2">
                <strong>When:</strong> {dayjs(detailDialog.scheduledAt).format("dddd, MMMM D YYYY [at] HH:mm")}
              </Typography>
              <Typography variant="body2">
                <strong>Duration:</strong> {detailDialog.durationMinutes} min
              </Typography>
              {detailDialog.notes && (
                <Typography variant="body2">
                  <strong>Notes:</strong> {detailDialog.notes}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                Application ID: {detailDialog.application.id}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailDialog(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
