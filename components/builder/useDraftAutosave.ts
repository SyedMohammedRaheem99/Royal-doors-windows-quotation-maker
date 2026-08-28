"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keeps an in-progress NEW quotation in localStorage so closing the tab,
 * a crash, or an accidental back-navigation doesn't lose a half-hour of
 * measurement entry.
 *
 * Deliberately scoped to new quotations only. An edit already has a saved
 * server copy, and a stale local draft silently overriding it would be worse
 * than losing the unsaved edits.
 *
 * localStorage rather than the server: a draft is worthless to anyone else,
 * writing it server-side on every keystroke would be wasteful, and this keeps
 * working with no connection — which matters at a site visit.
 */
const KEY = "royal-quote:new-draft";
const DEBOUNCE_MS = 800;

export interface DraftEnvelope<T> {
  savedAt: number;
  data: T;
}

export function loadDraft<T>(): DraftEnvelope<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed?.savedAt || !parsed?.data) return null;
    return parsed;
  } catch {
    // Corrupt or unparseable draft — treat as absent rather than crashing
    // the builder on load.
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage disabled or full — nothing useful to do */
  }
}

/**
 * Debounced write of the current builder state. Returns the timestamp of the
 * last successful save so the UI can show "Draft saved".
 */
export function useDraftAutosave<T>(data: T, enabled: boolean): number | null {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        const now = Date.now();
        window.localStorage.setItem(KEY, JSON.stringify({ savedAt: now, data }));
        setSavedAt(now);
      } catch {
        // Quota exceeded or storage disabled (private browsing). Autosave is
        // a safety net, not a feature the builder depends on, so this stays
        // silent rather than nagging the user mid-entry.
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, enabled]);

  return savedAt;
}
