"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Failed to load dashboard</h2>
      <p style={{ color: "grey", marginBottom: "1rem" }}>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
