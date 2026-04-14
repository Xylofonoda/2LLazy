"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography, Stack, Button, Snackbar, Alert } from "@mui/material";
import dayjs from "dayjs";
import { InterviewDetailDialog } from "@/components/interviews/InterviewDetailDialog";
import { CalendarEventDialog } from "@/components/interviews/CalendarEventDialog";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEntriesAction,
} from "@/lib/actions/interviewActions";
import { CalendarMonthNav } from "./CalendarMonthNav";
import { CalendarGrid } from "./CalendarGrid";
import type { CalendarEntry, CalendarEventForm } from "@/types";

const DEFAULT_FORM: CalendarEventForm = {
  title: "",
  scheduledAt: dayjs().format("YYYY-MM-DDTHH:mm"),
  durationMinutes: 60,
  notes: "",
};

interface Props {
  initialEntries: CalendarEntry[];
  month: number;
  year: number;
}

export function InterviewsClient({ initialEntries, month, year }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);

  // Client-side month state — avoids full SSR round-trips on navigation
  const [currentMonth, setCurrentMonth] = useState(() => dayjs(new Date(year, month - 1, 1)));
  const [entries, setEntries] = useState<CalendarEntry[]>(initialEntries);

  // Prefetch cache: key = "M-YYYY" → entries
  const prefetchCache = useRef<Map<string, CalendarEntry[]>>(new Map());

  const cacheKey = (m: dayjs.Dayjs) => `${m.month() + 1}-${m.year()}`;

  /** Pre-fetch a month into the local cache without triggering any UI update. */
  const prefetch = useCallback((target: dayjs.Dayjs) => {
    const key = cacheKey(target);
    if (prefetchCache.current.has(key)) return;
    fetchCalendarEntriesAction(target.month() + 1, target.year()).then((data) => {
      prefetchCache.current.set(key, data);
    });
  }, []);

  // After initial render, prefetch the adjacent months
  useEffect(() => {
    prefetch(currentMonth.subtract(1, "month"));
    prefetch(currentMonth.add(1, "month"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateMonth = async (delta: 1 | -1) => {
    const next = currentMonth.add(delta, "month");
    const key = cacheKey(next);
    setIsNavigating(true);

    // Use cached data if available, otherwise fetch
    const cached = prefetchCache.current.get(key);
    if (cached) {
      setCurrentMonth(next);
      setEntries(cached);
      setIsNavigating(false);
    } else {
      try {
        const data = await fetchCalendarEntriesAction(next.month() + 1, next.year());
        prefetchCache.current.set(key, data);
        setCurrentMonth(next);
        setEntries(data);
      } catch {
        // fall back to URL navigation if action fails
        router.push(`/interviews?month=${next.month() + 1}&year=${next.year()}`);
      } finally {
        setIsNavigating(false);
      }
    }

    // Sync URL without triggering a re-render
    window.history.replaceState(null, "", `/interviews?month=${next.month() + 1}&year=${next.year()}`);

    // Pre-fetch the next step ahead
    prefetch(next.add(delta, "month"));
  };

  // Refresh entries for the current month after mutations
  const refreshCurrentMonth = () => {
    const key = cacheKey(currentMonth);
    prefetchCache.current.delete(key); // bust local cache
    fetchCalendarEntriesAction(currentMonth.month() + 1, currentMonth.year()).then((data) => {
      prefetchCache.current.set(key, data);
      setEntries(data);
    });
  };

  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);
  const [eventDialog, setEventDialog] = useState<{
    open: boolean;
    editId: string | null;
    form: CalendarEventForm;
  }>({ open: false, editId: null, form: DEFAULT_FORM });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);

  const openCreateDialog = (scheduledAt: string = dayjs().format("YYYY-MM-DDTHH:mm")) => {
    setEventDialog({ open: true, editId: null, form: { ...DEFAULT_FORM, scheduledAt } });
  };

  const openEditDialog = (entry: CalendarEntry) => {
    setSelectedEntry(null);
    setEventDialog({
      open: true,
      editId: entry.id,
      form: {
        title: entry.title,
        scheduledAt: dayjs(entry.scheduledAt).format("YYYY-MM-DDTHH:mm"),
        durationMinutes: entry.durationMinutes,
        notes: entry.notes ?? "",
      },
    });
  };

  const closeEventDialog = () =>
    setEventDialog({ open: false, editId: null, form: DEFAULT_FORM });

  const handleSaveEvent = () => {
    setIsSaving(true);
    startTransition(async () => {
      try {
        if (eventDialog.editId) {
          await updateCalendarEvent(eventDialog.editId, eventDialog.form);
          setToast({ message: "Event updated.", severity: "success" });
        } else {
          await createCalendarEvent(eventDialog.form);
          setToast({ message: "Event created.", severity: "success" });
        }
        closeEventDialog();
        refreshCurrentMonth();
      } catch (err) {
        setToast({ message: String(err), severity: "error" });
      } finally {
        setIsSaving(false);
      }
    });
  };

  const handleDeleteEvent = () => {
    if (!eventDialog.editId) return;
    const idToDelete = eventDialog.editId;
    setIsSaving(true);
    startTransition(async () => {
      try {
        await deleteCalendarEvent(idToDelete);
        setToast({ message: "Event deleted.", severity: "success" });
        closeEventDialog();
        refreshCurrentMonth();
      } catch (err) {
        setToast({ message: String(err), severity: "error" });
      } finally {
        setIsSaving(false);
      }
    });
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Interview Calendar</Typography>
        <Button variant="contained" onClick={() => openCreateDialog()}>
          + Add Event
        </Button>
      </Stack>

      <CalendarMonthNav
        currentMonth={currentMonth}
        isPending={isNavigating}
        onPrev={() => navigateMonth(-1)}
        onNext={() => navigateMonth(1)}
      />

      {entries.length === 0 && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
            alignItems: "center",
            "& .MuiAlert-message": {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexGrow: 1,
              gap: 2,
              flexWrap: "wrap",
            },
          }}
        >
          <span>No events in this month yet. Add an interview or reminder to stay on top of your process.</span>
          <Button variant="outlined" size="small" onClick={() => openCreateDialog()}>
            Add Event
          </Button>
        </Alert>
      )}

      <CalendarGrid
        currentMonth={currentMonth}
        entries={entries}
        onEntryClick={setSelectedEntry}
        onDayDoubleClick={openCreateDialog}
      />

      <InterviewDetailDialog
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onEdit={openEditDialog}
      />

      <CalendarEventDialog
        open={eventDialog.open}
        form={eventDialog.form}
        editId={eventDialog.editId}
        isSaving={isSaving}
        onChange={(form) => setEventDialog((prev) => ({ ...prev, form }))}
        onClose={closeEventDialog}
        onSubmit={handleSaveEvent}
        onDelete={eventDialog.editId ? handleDeleteEvent : undefined}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          severity={toast?.severity}
          onClose={() => setToast(null)}
          sx={{ width: "100%" }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}


const DEFAULT_FORM: CalendarEventForm = {
  title: "",
  scheduledAt: dayjs().format("YYYY-MM-DDTHH:mm"),
  durationMinutes: 60,
  notes: "",
};

interface Props {
  initialEntries: CalendarEntry[];
  month: number;
  year: number;
}

export function InterviewsClient({ initialEntries, month, year }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isNavigating, startNavigation] = useTransition();

  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);
  const [eventDialog, setEventDialog] = useState<{
    open: boolean;
    editId: string | null;
    form: CalendarEventForm;
  }>({ open: false, editId: null, form: DEFAULT_FORM });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);

  const currentMonth = dayjs(new Date(year, month - 1, 1));

  const navigateMonth = (delta: 1 | -1) => {
    startNavigation(() => {
      const next = currentMonth.add(delta, "month");
      router.push(`/interviews?month=${next.month() + 1}&year=${next.year()}`);
    });
  };

  const openCreateDialog = (scheduledAt: string = dayjs().format("YYYY-MM-DDTHH:mm")) => {
    setEventDialog({ open: true, editId: null, form: { ...DEFAULT_FORM, scheduledAt } });
  };

  const openEditDialog = (entry: CalendarEntry) => {
    setSelectedEntry(null);
    setEventDialog({
      open: true,
      editId: entry.id,
      form: {
        title: entry.title,
        scheduledAt: dayjs(entry.scheduledAt).format("YYYY-MM-DDTHH:mm"),
        durationMinutes: entry.durationMinutes,
        notes: entry.notes ?? "",
      },
    });
  };

  const closeEventDialog = () =>
    setEventDialog({ open: false, editId: null, form: DEFAULT_FORM });

  const handleSaveEvent = () => {
    setIsSaving(true);
    startTransition(async () => {
      try {
        if (eventDialog.editId) {
          await updateCalendarEvent(eventDialog.editId, eventDialog.form);
          setToast({ message: "Event updated.", severity: "success" });
        } else {
          await createCalendarEvent(eventDialog.form);
          setToast({ message: "Event created.", severity: "success" });
        }
        closeEventDialog();
        router.refresh();
      } catch (err) {
        setToast({ message: String(err), severity: "error" });
      } finally {
        setIsSaving(false);
      }
    });
  };

  const handleDeleteEvent = () => {
    if (!eventDialog.editId) return;
    const idToDelete = eventDialog.editId;
    setIsSaving(true);
    startTransition(async () => {
      try {
        await deleteCalendarEvent(idToDelete);
        setToast({ message: "Event deleted.", severity: "success" });
        closeEventDialog();
        router.refresh();
      } catch (err) {
        setToast({ message: String(err), severity: "error" });
      } finally {
        setIsSaving(false);
      }
    });
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Interview Calendar</Typography>
        <Button variant="contained" onClick={() => openCreateDialog()}>
          + Add Event
        </Button>
      </Stack>

      <CalendarMonthNav
        currentMonth={currentMonth}
        isPending={isNavigating}
        onPrev={() => navigateMonth(-1)}
        onNext={() => navigateMonth(1)}
      />

      {initialEntries.length === 0 && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
            alignItems: "center",
            "& .MuiAlert-message": {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexGrow: 1,
              gap: 2,
              flexWrap: "wrap",
            },
          }}
        >
          <span>No events in this month yet. Add an interview or reminder to stay on top of your process.</span>
          <Button variant="outlined" size="small" onClick={() => openCreateDialog()}>
            Add Event
          </Button>
        </Alert>
      )}

      <CalendarGrid
        currentMonth={currentMonth}
        entries={initialEntries}
        onEntryClick={setSelectedEntry}
        onDayDoubleClick={openCreateDialog}
      />

      <InterviewDetailDialog
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onEdit={openEditDialog}
      />

      <CalendarEventDialog
        open={eventDialog.open}
        form={eventDialog.form}
        editId={eventDialog.editId}
        isSaving={isSaving}
        onChange={(form) => setEventDialog((prev) => ({ ...prev, form }))}
        onClose={closeEventDialog}
        onSubmit={handleSaveEvent}
        onDelete={eventDialog.editId ? handleDeleteEvent : undefined}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          severity={toast?.severity}
          onClose={() => setToast(null)}
          sx={{ width: "100%" }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
