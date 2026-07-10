import {
  ArrowRight,
  BarChart3,
  Navigation2,
  Smartphone,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { FtueBracketText } from './FtueBracketText'
import { FtueMapScene } from './FtueMapScene'
import { FtueTopoBackground } from './FtueTopoBackground'
import { SignInPanel } from './SignInPanel'
import { usePwaInstall } from '../lib/pwa-install'
import { cn } from '../lib/cn'

const STEP_COUNT = 3

type FtueOverlayProps = {
  onComplete: () => void
}

export function FtueOverlay({ onComplete }: FtueOverlayProps) {
  const [step, setStep] = useState(0)
  const { canInstall, installed, promptInstall } = usePwaInstall()

  const goNext = () => {
    if (step < STEP_COUNT - 1) {
      setStep((value) => value + 1)
      return
    }
    onComplete()
  }

  return (
    <div className="ftue-shell fixed inset-0 z-[200] flex flex-col">
      <FtueTopoBackground />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-4 pt-10 sm:px-8 sm:pt-12">
          {step === 0 && <FtueFeaturesStep />}
          {step === 1 && (
            <FtuePwaStep
              canInstall={canInstall}
              installed={installed}
              onInstall={() => void promptInstall()}
            />
          )}
          {step === 2 && (
            <FtueAuthStep onAuthSuccess={onComplete} onSkip={onComplete} />
          )}
        </div>

        {step < 2 ? (
          <footer className="relative z-10 shrink-0 px-6 pb-8 pt-2 sm:px-8">
            <button type="button" onClick={goNext} className="ftue-cta">
              <Navigation2 className="size-5" strokeWidth={2.5} />
              <span>Continue</span>
            </button>
          </footer>
        ) : null}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center gap-2 px-6 pt-5"
        aria-label="Tutorial progress"
      >
        {Array.from({ length: STEP_COUNT }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1.5 rounded-full transition-all',
              index === step ? 'w-8 bg-[var(--brand)]' : 'w-3 bg-black/10',
            )}
          />
        ))}
      </div>
    </div>
  )
}

function FtueFeatureItem({
  icon: Icon,
  text,
}: {
  icon: LucideIcon
  text: string
}) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="ftue-icon-badge">
        <Icon className="size-4" strokeWidth={2.5} />
      </span>
      <p className="ftue-feature-copy m-0">
        <FtueBracketText text={text} />
      </p>
    </li>
  )
}

function FtueFeaturesStep() {
  const items = [
    { icon: Navigation2, text: '(Record) your trips' },
    {
      icon: Users,
      text: '(Crew) can add (log entries, photos) and (video).',
    },
    {
      icon: BarChart3,
      text: 'Uncover (detailed stats) and (insights).',
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <h1 className="ftue-headline rise-in mb-8 max-w-[16ch]">
        The all-in-one app for your sailing adventures
      </h1>
      <ul className="m-0 flex list-none flex-col gap-5 p-0">
        {items.map((item) => (
          <FtueFeatureItem key={item.text} icon={item.icon} text={item.text} />
        ))}
      </ul>
      <FtueMapScene />
    </div>
  )
}

function FtuePwaStep({
  canInstall,
  installed,
  onInstall,
}: {
  canInstall: boolean
  installed: boolean
  onInstall: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <h1 className="ftue-headline rise-in mb-6 max-w-[14ch]">
        No install required
      </h1>
      <p className="ftue-feature-copy m-0 max-w-md text-lg leading-relaxed">
        <FtueBracketText text="You and your crew can always use the (web version) for (free!)." />
      </p>

      <div className="mt-8">
        <button
          type="button"
          onClick={onInstall}
          disabled={installed}
          className={cn('ftue-secondary-btn', installed && 'opacity-60')}
        >
          <Smartphone className="size-4" />
          {installed ? 'Already on home screen' : 'Add to home screen'}
        </button>
        {!canInstall && !installed && (
          <p className="m-0 mt-3 max-w-sm text-sm leading-6 text-[var(--ftue-ink-soft)]">
            On iPhone, tap Share then Add to Home Screen. On Android or desktop,
            use your browser&apos;s install option when it appears.
          </p>
        )}
      </div>

      <FtueMapScene />
    </div>
  )
}

function FtueAuthStep({
  onAuthSuccess,
  onSkip,
}: {
  onAuthSuccess: () => void
  onSkip: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col pb-6">
      <h1 className="ftue-headline rise-in mb-3">Sign in to sync</h1>
      <p className="m-0 mb-6 max-w-md text-sm leading-6 text-[var(--ftue-ink-soft)]">
        Create an account to sync trips across devices, or continue without
        signing in.
      </p>

      <div className="ftue-auth-card rounded-[1.75rem] p-5 sm:p-6">
        <SignInPanel embedded onAuthSuccess={onAuthSuccess} />
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="ftue-secondary-btn mt-5 w-full justify-center"
      >
        Continue without account
        <ArrowRight className="size-4" />
      </button>
    </div>
  )
}
