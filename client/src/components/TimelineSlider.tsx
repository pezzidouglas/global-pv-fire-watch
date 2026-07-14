import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History } from "lucide-react";

export type TimelineRange = { start: number; end: number };

type Props = {
  /** Overall span (UTC ms) of the data */
  min: number;
  max: number;
  /** Current selected range */
  value: TimelineRange;
  onChange: (range: TimelineRange) => void;
  /** Dates (UTC ms) of all events in the current non-date scope, for the density histogram */
  eventDates: number[];
  /** Count of records currently in range (for the label) */
  matchCount: number;
};

const MONTH_MS = 30.44 * 24 * 3600 * 1000;

function fmt(ms: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(ms));
}

export default function TimelineSlider({ min, max, value, onChange, eventDates, matchCount }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  const span = Math.max(1, max - min);
  const toPct = useCallback((ms: number) => ((ms - min) / span) * 100, [min, span]);
  const clamp = useCallback((ms: number) => Math.min(max, Math.max(min, ms)), [min, max]);

  const bins = useMemo(() => {
    const BIN_COUNT = 40;
    const counts = new Array<number>(BIN_COUNT).fill(0);
    for (const d of eventDates) {
      if (d < min || d > max) continue;
      const idx = Math.min(BIN_COUNT - 1, Math.floor(((d - min) / span) * BIN_COUNT));
      counts[idx] += 1;
    }
    const peak = Math.max(1, ...counts);
    return counts.map((c) => c / peak);
  }, [eventDates, min, max, span]);

  const yearTicks = useMemo(() => {
    const startYear = new Date(min).getUTCFullYear();
    const endYear = new Date(max).getUTCFullYear();
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y += 1) {
      const ms = Date.UTC(y, 0, 1);
      if (ms >= min && ms <= max) years.push(y);
    }
    // Thin ticks if there are many years and the viewport is narrow-ish
    const step = years.length > 8 ? 2 : 1;
    return years.filter((_, i) => i % step === 0).map((y) => ({ year: y, pct: toPct(Date.UTC(y, 0, 1)) }));
  }, [min, max, toPct]);

  const posToMs = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return min;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return clamp(min + ratio * span);
  }, [clamp, min, span]);

  const moveHandle = useCallback((which: "start" | "end", ms: number) => {
    const minGap = MONTH_MS; // keep at least ~1 month between handles
    if (which === "start") {
      onChange({ start: Math.min(clamp(ms), value.end - minGap), end: value.end });
    } else {
      onChange({ start: value.start, end: Math.max(clamp(ms), value.start + minGap) });
    }
  }, [clamp, onChange, value.end, value.start]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => moveHandle(dragging, posToMs(event.clientX));
    const onUp = () => setDragging(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, moveHandle, posToMs]);

  const onTrackPointerDown = useCallback((event: React.PointerEvent) => {
    // Jump the nearest handle to the pressed position, then keep dragging it
    const ms = posToMs(event.clientX);
    const which = Math.abs(ms - value.start) <= Math.abs(ms - value.end) ? "start" : "end";
    moveHandle(which, ms);
    setDragging(which);
  }, [moveHandle, posToMs, value.end, value.start]);

  const onHandleKeyDown = useCallback((which: "start" | "end") => (event: React.KeyboardEvent) => {
    const current = which === "start" ? value.start : value.end;
    const yearStep = event.shiftKey ? 12 * MONTH_MS : MONTH_MS;
    let next: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - yearStep;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current + yearStep;
    if (event.key === "Home") next = which === "start" ? min : value.start + MONTH_MS;
    if (event.key === "End") next = which === "end" ? max : value.end - MONTH_MS;
    if (next !== null) {
      event.preventDefault();
      moveHandle(which, next);
    }
  }, [max, min, moveHandle, value.end, value.start]);

  const startPct = toPct(value.start);
  const endPct = toPct(value.end);
  const isFullRange = value.start <= min && value.end >= max;

  return (
    <div className="timeline-slider" aria-label="Timeline date filter">
      <div className="timeline-head">
        <span className="timeline-title"><History size={14} /> Timeline</span>
        <span className="timeline-range-label">
          {fmt(value.start)} – {fmt(value.end)} · {matchCount} records
          {!isFullRange && (
            <button
              type="button"
              className="timeline-reset"
              onClick={() => onChange({ start: min, end: max })}
            >
              Reset
            </button>
          )}
        </span>
      </div>
      <div
        ref={trackRef}
        className="timeline-track"
        onPointerDown={onTrackPointerDown}
      >
        <div className="timeline-bins" aria-hidden="true">
          {bins.map((h, i) => {
            const binPct = (i + 0.5) * (100 / bins.length);
            const active = binPct >= startPct && binPct <= endPct;
            return <i key={i} style={{ height: `${Math.max(8, h * 100)}%` }} className={active ? "active" : ""} />;
          })}
        </div>
        <div className="timeline-rail" aria-hidden="true" />
        <div className="timeline-fill" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} aria-hidden="true" />
        <button
          type="button"
          className="timeline-handle"
          style={{ left: `${startPct}%` }}
          role="slider"
          aria-label="Timeline start date"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value.start}
          aria-valuetext={fmt(value.start)}
          onPointerDown={(event) => { event.stopPropagation(); setDragging("start"); }}
          onKeyDown={onHandleKeyDown("start")}
        />
        <button
          type="button"
          className="timeline-handle"
          style={{ left: `${endPct}%` }}
          role="slider"
          aria-label="Timeline end date"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value.end}
          aria-valuetext={fmt(value.end)}
          onPointerDown={(event) => { event.stopPropagation(); setDragging("end"); }}
          onKeyDown={onHandleKeyDown("end")}
        />
      </div>
      <div className="timeline-ticks" aria-hidden="true">
        {yearTicks.map(({ year, pct }) => (
          <span key={year} style={{ left: `${pct}%` }}>{year}</span>
        ))}
      </div>
    </div>
  );
}
