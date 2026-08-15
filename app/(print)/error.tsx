"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

// (print) is a sibling route group with no boundary of its own — without
// this, a failure rendering the branded document falls through to
// global-error.tsx and loses the app chrome entirely.
export default function PrintError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[print] render failed:", error);
  }, [error]);

  return (
    <ErrorState
      title="Couldn't generate the print view"
      description="The quotation itself is unaffected — try again, or open it from the Quotations list instead."
      digest={error.digest}
      onRetry={retry}
    />
  );
}
