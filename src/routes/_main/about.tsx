import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Camera,
  Compass,
  FolderOpen,
  MapPin,
  Users,
  WifiOff,
} from 'lucide-react'
import { PublicPage } from '../../components/PublicPage'
import { legalCanonical } from '../../lib/legal'

const description =
  'Your sailing life, all in one logbook. Record trips, capture photos and notes, keep boat records together, and revisit every journey with Logmaster.'

export const Route = createFileRoute('/_main/about')({
  head: () => ({
    meta: [
      { title: 'Logmaster — Your sailing life, all in one logbook' },
      { name: 'description', content: description },
      {
        property: 'og:title',
        content: 'Logmaster — Keep the story of every voyage',
      },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: legalCanonical('/about') },
    ],
    links: [{ rel: 'canonical', href: legalCanonical('/about') }],
  }),
  component: About,
})

const features = [
  {
    icon: Compass,
    title: 'Record your journeys',
    text: 'Start a trip, record your GPS track, and build a history of your time on the water.',
  },
  {
    icon: Camera,
    title: 'Remember the small details',
    text: 'Add photos and notes to your log, from a favourite anchorage to an unforgettable arrival.',
  },
  {
    icon: MapPin,
    title: 'Revisit every voyage',
    text: 'Review your trips on the map and follow the places and moments that shaped each journey.',
  },
  {
    icon: FolderOpen,
    title: 'Keep your boat organized',
    text: 'Bring boat details, equipment records, documents, and photos together in one place.',
  },
  {
    icon: Users,
    title: 'Bring your crew together',
    text: 'Add crew to your trips and remember who shared each adventure.',
  },
  {
    icon: WifiOff,
    title: 'Keep your log close',
    text: 'Save log entries locally and sync when connectivity is available. Sign in to sync across your devices.',
  },
]

function About() {
  return (
    <PublicPage>
      <section className="grid items-center gap-12 pb-16 lg:grid-cols-[1.4fr_1fr] lg:gap-20 sm:pb-24">
        <div>
          <p className="island-kicker mb-5">A logbook for life on the water</p>
          <h1 className="display-title m-0 max-w-3xl text-5xl leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            Keep the story of{' '}
            <span className="text-[color:var(--brand)]">every voyage.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--sea-ink-soft)]">
            The places you discover. The people on board. The details you want
            to remember. Bring them together with Logmaster, your sailing
            logbook.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              to="/"
              className="inline-flex items-center gap-3 rounded-full bg-[var(--btn-bg)] px-6 py-3.5 font-semibold text-[var(--btn-text)] hover:opacity-85"
            >
              Open Logmaster <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a
              href="#features"
              className="text-sm font-semibold underline underline-offset-4"
            >
              Explore the features
            </a>
          </div>
        </div>
        <aside
          className="rounded-3xl border border-[var(--line)] bg-[var(--chip-bg)] p-7 sm:p-10"
          aria-label="Your voyage, from departure to memories"
        >
          <Compass
            size={36}
            className="mb-8 text-[color:var(--brand)]"
            aria-hidden="true"
          />
          <p className="display-title mb-8 text-3xl leading-tight">
            More than where you went.
          </p>
          <ol className="space-y-7">
            {[
              ['01', 'Cast off', 'Start a trip and record the journey.'],
              [
                '02',
                'Capture the moment',
                'Add a photo, a note, a place to remember.',
              ],
              [
                '03',
                'Look back',
                'Keep your adventures together, season after season.',
              ],
            ].map(([number, title, text]) => (
              <li key={number} className="flex gap-4">
                <span
                  className="shrink-0 pt-1 text-xs font-bold text-[color:var(--brand)]"
                  aria-hidden="true"
                >
                  {number}
                </span>
                <div>
                  <p className="font-bold">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--sea-ink-soft)]">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>
      <section
        id="features"
        className="scroll-mt-8 border-t border-[var(--line)] py-14 sm:py-20"
      >
        <p className="island-kicker mb-3">One place for your sailing life</p>
        <h2 className="display-title max-w-2xl text-3xl sm:text-4xl">
          From an afternoon sail to a whole season.
        </h2>
        <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <section key={title}>
              <Icon
                size={24}
                className="mb-4 text-[color:var(--brand)]"
                aria-hidden="true"
              />
              <h3 className="mb-2 text-lg font-bold">{title}</h3>
              <p className="text-sm leading-7 text-[var(--sea-ink-soft)]">
                {text}
              </p>
            </section>
          ))}
        </div>
      </section>
      <section className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-[var(--chip-bg)] p-7 sm:p-10">
        <div>
          <h2 className="display-title text-3xl">
            Your next chapter starts on the water.
          </h2>
          <p className="mt-3 text-[var(--sea-ink-soft)]">
            Have a question before you get started? We’re here to help.
          </p>
        </div>
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 font-semibold underline underline-offset-4"
        >
          Contact us <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </PublicPage>
  )
}
