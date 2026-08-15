"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

// Covers every authenticated page. The most likely cause in production is the
// database being unreachable, which previously surfaced as a raw Next.js crash
// page with a stack trace.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] render failed:", error);
  }, [error]);

  return (
    <ErrorState
      title="This page couldn't be loaded"
      description="Something went wrong on our side. Your quotations and customer data have not been changed."
      digest={error.digest}
      onRetry={retry}
    />
  );
}
