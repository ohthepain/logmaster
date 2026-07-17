import { useEffect, useState } from "react";
import { cn } from "../lib/cn";

type Highlight = {
  x: number;
  y: number;
  size?: number;
};

type IosInstallStep = {
  image: string;
  instruction: string;
  highlight: Highlight;
};

const IOS_INSTALL_STEPS: IosInstallStep[] = [
  {
    image: "/ios_tut_1.PNG",
    instruction: "Tap the (...) button",
    highlight: { x: 88, y: 48, size: 14 },
  },
  {
    image: "/ios_tut_2.PNG",
    instruction: "Tap Share",
    highlight: { x: 18, y: 50, size: 16 },
  },
  {
    image: "/ios_tut_3.PNG",
    instruction: "Tap View More",
    highlight: { x: 82, y: 42, size: 14 },
  },
  {
    image: "/ios_tut_4.PNG",
    instruction: "Tap Add to Home Screen",
    highlight: { x: 22, y: 50, size: 14 },
  },
];

const STEP_MS = 3200;

export function FtueIosInstallGuide() {
  const [activeStep, setActiveStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActiveStep((value) => (value + 1) % IOS_INSTALL_STEPS.length);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  const step = IOS_INSTALL_STEPS[activeStep];
  const highlightSize = step.highlight.size ?? 14;

  return (
    <div
      className="mt-8 rounded-[1.5rem] border border-black/8 bg-[var(--ftue-surface)] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.08)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="m-0 text-sm font-semibold text-[var(--ftue-ink)]">
          Add to Home Screen in Safari
        </p>
        <span className="shrink-0 rounded-full bg-[var(--brand-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--brand)]">
          Step {activeStep + 1} of {IOS_INSTALL_STEPS.length}
        </span>
      </div>

      <p
        key={activeStep}
        className="ftue-ios-instruction m-0 mb-4 min-h-[1.5rem] text-base font-semibold text-[var(--ftue-ink)]"
      >
        {step.instruction}
      </p>

      <div className="relative overflow-hidden rounded-2xl border border-black/6 bg-[#f5f5f5]">
        <div key={activeStep} className="relative">
          <img
            src={step.image}
            alt=""
            className="block h-auto w-full"
            width={800}
            height={200}
            decoding="async"
          />

          <span
            className="ftue-ios-tap-highlight pointer-events-none"
            style={{
              left: `${step.highlight.x}%`,
              top: `${step.highlight.y}%`,
              width: `${highlightSize}%`,
              aspectRatio: "1",
            }}
            aria-hidden
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {IOS_INSTALL_STEPS.map((item, index) => (
          <button
            key={item.image}
            type="button"
            aria-label={`Show step ${index + 1}: ${item.instruction}`}
            aria-current={index === activeStep ? "step" : undefined}
            onClick={() => setActiveStep(index)}
            className={cn(
              "h-2 rounded-full transition-all",
              index === activeStep ? "w-6 bg-[var(--brand)]" : "w-2 bg-black/15 hover:bg-black/25",
            )}
          />
        ))}
      </div>
    </div>
  );
}
