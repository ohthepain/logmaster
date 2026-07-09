import { createFileRoute, Link } from '@tanstack/react-router'
import { LegalFooter } from '../../components/LegalFooter'

export const Route = createFileRoute('/_main/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">About</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          Built for sailing, not for signal bars.
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
          Logmaster keeps the trip timeline local first, then syncs in the
          background when the connection returns. The initial stack leaves room
          for auth, server sync, media handling, weather metadata, and future
          exports.
        </p>
        <p className="mt-6">
          <Link
            to="/"
            className="font-medium text-[var(--lagoon-deep)] underline decoration-[var(--lagoon-deep)]/50 underline-offset-2 hover:decoration-[var(--lagoon-deep)]"
          >
            Back to trips
          </Link>
        </p>
        <LegalFooter className="mt-8" />
      </section>
    </main>
  )
}
