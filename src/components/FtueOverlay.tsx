import { BarChart3, Navigation2, Smartphone, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { FtueBracketText } from "./FtueBracketText";
import { FtueMapScene } from "./FtueMapScene";
import { FtueTopoBackground } from "./FtueTopoBackground";
import { FtueIosInstallGuide } from "./FtueIosInstallGuide";
import { SignInPanel } from "./SignInPanel";
import { usePwaInstall } from "../lib/pwa-install";
import { useSession } from "../lib/auth-client";
import { isNativePlatform } from "../lib/platform";
import { cn } from "../lib/cn";
import { DevComponentLabel } from "./DevComponentLabel";

const AUTH_STEP_WEB = 2;

type FtueOverlayProps = {
  onComplete: () => void;
};

export function FtueOverlay({ onComplete }: FtueOverlayProps) {
  const session = useSession();
  const signedIn = Boolean(session.data?.user);
  const skipPwaStep = isNativePlatform();
  const authStep = skipPwaStep ? 1 : AUTH_STEP_WEB;
  const stepCount = signedIn
    ? skipPwaStep
      ? 1
      : 2
    : skipPwaStep
      ? 2
      : 3;
  const lastStep = stepCount - 1;

  const [step, setStep] = useState(0);
  const { canInstall, installed, promptInstall, isIosSafari } = usePwaInstall();

  const showAuthStep = !signedIn && step === authStep;

  const goNext = () => {
    if (step < lastStep) {
      setStep((value) => value + 1);
      return;
    }
    onComplete();
  };

  const continueLabel = step === lastStep ? "Get started" : "Continue";

  return (
    <div
      data-blocking-overlay
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tutorial"
      className="ftue-shell ios-map-touch-target fixed inset-0 z-[200] flex flex-col"
    >
      <DevComponentLabel
        name="FtueOverlay"
        className="absolute left-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-20 sm:left-4"
      />
      <FtueTopoBackground />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-4 pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] sm:px-8 sm:pt-[calc(env(safe-area-inset-top,0px)+3rem)]">
          {step === 0 && <FtueFeaturesStep />}
          {!skipPwaStep && step === 1 && (
            <FtuePwaStep
              canInstall={canInstall}
              installed={installed}
              isIosSafari={isIosSafari}
              onInstall={() => void promptInstall()}
            />
          )}
          {showAuthStep && <FtueAuthStep onAuthSuccess={onComplete} />}
        </div>

        {!showAuthStep ? (
          <footer className="ios-map-touch-target relative z-10 shrink-0 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-2 sm:px-8">
            <button type="button" onClick={goNext} className="ftue-cta ios-map-touch-target touch-manipulation">
              <Navigation2 className="size-5" strokeWidth={2.5} />
              <span>{continueLabel}</span>
            </button>
          </footer>
        ) : null}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center gap-2 px-6 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)]"
        aria-label="Tutorial progress"
      >
        {Array.from({ length: stepCount }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 rounded-full transition-all",
              index === step ? "w-8 bg-[var(--brand)]" : "w-3 bg-black/10",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function FtueFeatureItem({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="ftue-icon-badge">
        <Icon className="size-4" strokeWidth={2.5} />
      </span>
      <p className="ftue-feature-copy m-0">
        <FtueBracketText text={text} />
      </p>
    </li>
  );
}

function FtueFeaturesStep() {
  const items = [
    { icon: Navigation2, text: "(Record) your trips" },
    {
      icon: Users,
      text: "(Crew) can add (log entries, photos) and (video).",
    },
    {
      icon: BarChart3,
      text: "Uncover (detailed stats) and (insights).",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <p className="m-0 my-4 text-base ftue-headline font-semibold text-[var(--ftue-ink-soft)]">
        Welcome to <span className="brand-title">logmaster</span>
      </p>
      <h1 className="text-xl rise-in mb-8">The all-in-one logging app for your sailing adventures</h1>
      <ul className="m-0 flex list-none flex-col gap-5 p-0">
        {items.map((item) => (
          <FtueFeatureItem key={item.text} icon={item.icon} text={item.text} />
        ))}
      </ul>
      <FtueMapScene />
    </div>
  );
}

function FtuePwaStep({
  canInstall,
  installed,
  isIosSafari,
  onInstall,
}: {
  canInstall: boolean;
  installed: boolean;
  isIosSafari: boolean;
  onInstall: () => void;
}) {
  const showIosGuide = isIosSafari && !installed;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <h1 className="ftue-headline rise-in mb-6 max-w-[14ch]">No install required</h1>
      <p className="ftue-feature-copy m-0 max-w-md text-lg leading-relaxed">
        <FtueBracketText text="You and your crew can always use the (web version) for (free!)." />
      </p>

      {installed ? (
        <p className="m-0 mt-8 text-sm font-semibold text-[var(--ftue-ink-soft)]">
          logmaster is already on your home screen.
        </p>
      ) : showIosGuide ? (
        <FtueIosInstallGuide />
      ) : (
        <div className="mt-8">
          <button type="button" onClick={onInstall} className="ftue-secondary-btn ios-map-touch-target touch-manipulation">
            <Smartphone className="size-4" />
            Add to home screen
          </button>
          {!canInstall && (
            <p className="m-0 mt-3 max-w-sm text-sm leading-6 text-[var(--ftue-ink-soft)]">
              On Android or desktop, use your browser&apos;s install option when it appears.
            </p>
          )}
        </div>
      )}

      {!showIosGuide && <FtueMapScene />}
    </div>
  );
}

function FtueAuthStep({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col pb-6">
      <div className="ftue-auth-card ios-map-touch-target rounded-[1.75rem] p-5 sm:p-6">
        <SignInPanel embedded onAuthSuccess={onAuthSuccess} />
      </div>
    </div>
  );
}
