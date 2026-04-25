"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { subscribeToUserSessions, type Session } from "@/lib/firestore";

type SessionWithId = Session & { id: string };

interface GlobalExpiryReminderProps {
  userId: string;
}

function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) {
    return "0 min";
  }

  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours > 0 && rem > 0) {
    return `${hours}h ${rem}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${rem}m`;
}

export function GlobalExpiryReminder({ userId }: GlobalExpiryReminderProps) {
  const [sessions, setSessions] = useState<SessionWithId[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [dismissedSessionId, setDismissedSessionId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToUserSessions(userId, (rows) => setSessions(rows));
  }, [userId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  const reminderSession = useMemo(() => {
    const active = sessions
      .filter((session) => (session.approval_status ?? "accepted") === "accepted")
      .filter((session) => session.status === "checked_in")
      .filter((session) => session.end_time_ms > nowMs)
      .sort((left, right) => left.end_time_ms - right.end_time_ms);

    const session = active.find((item) => {
      const minutesLeft = Math.ceil((item.end_time_ms - nowMs) / (60 * 1000));
      return minutesLeft > 0 && minutesLeft <= 10;
    });

    return session ?? null;
  }, [sessions, nowMs]);

  useEffect(() => {
    if (!reminderSession) {
      return;
    }

    const reminderKey = `global-expiry-reminder-${reminderSession.id}`;
    const alreadyNotified = window.localStorage.getItem(reminderKey) === "1";
    if (alreadyNotified) {
      return;
    }

    const notify = () => {
      window.localStorage.setItem(reminderKey, "1");

      if (!("Notification" in window)) {
        return;
      }

      const dispatch = () => {
        try {
          new Notification("Parking session ending soon", {
            body: "Your slot is about to expire. Open My Bookings to extend.",
          });
        } catch {
          // Browser may block notification in some contexts.
        }
      };

      if (Notification.permission === "granted") {
        dispatch();
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission()
          .then((permission) => {
            if (permission === "granted") {
              dispatch();
            }
          })
          .catch(() => {
            // Non-blocking.
          });
      }
    };

    const triggerAt = reminderSession.end_time_ms - 10 * 60 * 1000;
    const delay = Math.max(0, triggerAt - Date.now());
    const timeoutId = window.setTimeout(() => notify(), delay);

    return () => window.clearTimeout(timeoutId);
  }, [reminderSession]);

  if (!reminderSession || dismissedSessionId === reminderSession.id) {
    return null;
  }

  const minutesLeft = Math.max(1, Math.ceil((reminderSession.end_time_ms - nowMs) / (60 * 1000)));

  return (
    <div className="global-expiry-banner" role="status" aria-live="polite">
      <p className="global-expiry-text">
        Slot ending soon: booking <strong>{reminderSession.access_code}</strong> ends in{" "}
        <strong>{formatDurationMinutes(minutesLeft)}</strong>. Extend now if needed.
      </p>
      <div className="global-expiry-actions">
        <Link href="/booking" className="global-expiry-link">
          Open My Bookings
        </Link>
        <button
          type="button"
          className="global-expiry-dismiss"
          onClick={() => setDismissedSessionId(reminderSession.id)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
