import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 5, 10, 25, 100] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export function formatPlaybackSpeed(speed: PlaybackSpeed): string {
  if (speed === 0.5) return ".5×";
  if (Number.isInteger(speed)) return `${speed}×`;
  return `${speed}×`;
}

const HOLD_MS = 220;
const DRAG_STEP_PX = 24;

type PlaybackSpeedControlProps = {
  speedIndex: number;
  onSpeedIndexChange: (index: number) => void;
};

type SpeedDragState = {
  pointerId: number;
  startY: number;
  startIndex: number;
  lastAppliedIndex: number;
  dragMode: boolean;
  holdTimer: ReturnType<typeof setTimeout> | null;
};

function clampSpeedIndex(index: number) {
  return Math.min(PLAYBACK_SPEEDS.length - 1, Math.max(0, index));
}

export function PlaybackSpeedControl({ speedIndex, onSpeedIndexChange }: PlaybackSpeedControlProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<SpeedDragState | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      {menuOpen ? (
        <div
          role="listbox"
          aria-label="Playback speed"
          className="absolute bottom-full right-0 z-40 mb-2 flex min-w-[4.5rem] flex-col overflow-hidden rounded-xl border border-white/25 bg-black/80 py-1 shadow-xl backdrop-blur-md"
        >
          {PLAYBACK_SPEEDS.map((speed, index) => (
            <button
              key={speed}
              type="button"
              role="option"
              aria-selected={index === speedIndex}
              data-playback-control
              onClick={() => {
                onSpeedIndexChange(index);
                setMenuOpen(false);
              }}
              className={cn(
                "px-4 py-1.5 text-left text-sm font-semibold tabular-nums",
                index === speedIndex ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              {formatPlaybackSpeed(speed)}
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        data-playback-control
        aria-label={`Playback speed ${formatPlaybackSpeed(PLAYBACK_SPEEDS[speedIndex])}`}
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
        className="touch-none select-none inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm font-semibold tabular-nums text-white/75 hover:bg-white/20 hover:text-white"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const holdTimer = setTimeout(() => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            drag.dragMode = true;
            setMenuOpen(false);
          }, HOLD_MS);
          dragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startIndex: speedIndex,
            lastAppliedIndex: speedIndex,
            dragMode: false,
            holdTimer,
          };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId || !drag.dragMode) return;
          const steps = Math.round(-(event.clientY - drag.startY) / DRAG_STEP_PX);
          const next = clampSpeedIndex(drag.startIndex + steps);
          if (next !== drag.lastAppliedIndex) {
            drag.lastAppliedIndex = next;
            onSpeedIndexChange(next);
          }
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          event.currentTarget.releasePointerCapture(event.pointerId);
          if (drag.holdTimer) clearTimeout(drag.holdTimer);
          if (!drag.dragMode) setMenuOpen((open) => !open);
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          const drag = dragRef.current;
          if (drag?.holdTimer) clearTimeout(drag.holdTimer);
          dragRef.current = null;
        }}
      >
        {formatPlaybackSpeed(PLAYBACK_SPEEDS[speedIndex])}
      </button>
    </div>
  );
}
