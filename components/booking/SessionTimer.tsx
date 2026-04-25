"use client";

import { useEffect, useMemo, useState } from "react";

interface SessionTimerProps {
  expiresAt: number;
}

export function SessionTimer({ expiresAt }: SessionTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    const updateRemaining = () => {
      setRemainingSeconds(Math.max(Math.floor((expiresAt - Date.now()) / 1000), 0));
    };

    updateRemaining();

    const interval = window.setInterval(() => {
      updateRemaining();
    }, 1000);

    return () => window.clearInterval(interval);
  }, [expiresAt]);

  const timerColor = useMemo(() => {
    if (remainingSeconds > 5 * 60) {
      return "#14b8a6";
    }

    if (remainingSeconds > 2 * 60) {
      return "#f59e0b";
    }

    return "#ef4444";
  }, [remainingSeconds]);

  const minutes = Math.floor(remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");

  return (
    <div className="toggle-row">
      <span>OTP expires in</span>
      <strong style={{ color: timerColor }}>
        {minutes}:{seconds}
      </strong>
    </div>
  );
}
