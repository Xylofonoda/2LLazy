"use client";

import { Alert } from "@mui/material";

interface Props {
  errors: string[];
  onDismiss: (index: number) => void;
}

/**
 * Renders a stack of dismissable warning alerts.
 * Shared between the Search and Favourites pages.
 */
export function ErrorAlertList({ errors, onDismiss }: Props) {
  if (!errors.length) return null;
  return (
    <>
      {errors.map((e, i) => (
        <Alert
          key={i}
          severity="warning"
          sx={{ mb: 1 }}
          onClose={() => onDismiss(i)}
        >
          {e}
        </Alert>
      ))}
    </>
  );
}
