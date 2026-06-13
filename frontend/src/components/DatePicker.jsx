"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Self-contained calendar date picker (no external deps). Value is a
// "YYYY-MM-DD" string. Optional min/max ("YYYY-MM-DD") disable out-of-range
// days. Built to match the app's plain-Tailwind styling.

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad2 = (n) => String(n).padStart(2, "0");
const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseYMD = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export default function DatePicker({ value, onChange, min, max, className = "" }) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseYMD(value), [value]);
  const [view, setView] = useState(() => parseYMD(value) || new Date());
  const wrapRef = useRef(null);

  // Keep the displayed month in sync when the value changes externally.
  useEffect(() => {
    const d = parseYMD(value);
    if (d) setView(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [value]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const y = view.getFullYear();
  const m = view.getMonth();
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayYMD = toYMD(new Date());

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const isDisabled = (ymd) => (min && ymd < min) || (max && ymd > max);

  const label = selected
    ? selected.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Pick a date";

  const pick = (d) => {
    const ymd = toYMD(new Date(y, m, d));
    if (isDisabled(ymd)) return;
    onChange?.(ymd);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span>{label}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          {/* Month header */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setView(new Date(y, m - 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-transparent border-0 text-gray-500 hover:bg-gray-100"
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="text-sm font-medium text-gray-800">
              {MONTHS[m]} {y}
            </div>
            <button
              type="button"
              onClick={() => setView(new Date(y, m + 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-transparent border-0 text-gray-500 hover:bg-gray-100"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          {/* Weekday row */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[11px] font-medium text-gray-400 py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (d === null) return <div key={`b${i}`} />;
              const ymd = toYMD(new Date(y, m, d));
              const isSelected = value === ymd;
              const isToday = todayYMD === ymd;
              const disabled = isDisabled(ymd);
              return (
                <button
                  key={ymd}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(d)}
                  className={`h-8 w-8 mx-auto flex items-center justify-center rounded-md text-sm border-0 transition-colors ${
                    isSelected
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : disabled
                      ? "bg-transparent text-gray-300 cursor-not-allowed"
                      : isToday
                      ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      : "bg-transparent text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
