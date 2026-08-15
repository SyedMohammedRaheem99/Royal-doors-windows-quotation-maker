"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: catches failures in the root layout itself, which the
 * nested error.tsx files cannot. It replaces the whole document, so it must
 * render its own <html>/<body> and cannot rely on global styles being loaded.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[global] render failed:", error);
  }, [error]);

  return (
    <html lang="en">
      <title>Something went wrong</title>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          background: "#0f3d2e",
          color: "#f5f5f4",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
          <h1 style={{ color: "#c9a227", fontSize: 20, margin: "0 0 8px" }}>Royal Doors &amp; Windows</h1>
          <p style={{ fontSize: 14, opacity: 0.85, margin: "0 0 20px" }}>
            The application failed to start. Your data has not been changed.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              background: "#c9a227",
              color: "#0f3d2e",
              border: "none",
              borderRadius: 4,
              padding: "8px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: 18, fontSize: 10, opacity: 0.4, fontFamily: "monospace" }}>ref: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
