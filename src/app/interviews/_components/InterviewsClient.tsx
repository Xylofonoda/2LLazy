"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography, Stack, Button, Snackbar, Alert } from "@mui/material";
import dayjs from "dayjs";
import { InterviewDetailDialog } from "@/components/interviews/InterviewDetailDialog";
import { CalendarEventDialog } from "@/components/interviews/CalendarEventDialog";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
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
