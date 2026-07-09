import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { LEGAL_LAST_UPDATED } from '../lib/legal'

type LegalSection = {
  id: string
  title: string
  content: ReactNode
}

type LegalPageProps = {
  kicker: string
  title: string
  intro: ReactNode
  sections: LegalSection[]
}

export function LegalPage({ kicker, title, intro, sections }: LegalPageProps) {
  return (
    <main className="page-wrap px-4 py-12">
      <article className="island-shell mx-auto max-w-3xl rounded-2xl p-6 sm:p-10">
        <p className="island-kicker mb-2">{kicker}</p>
        <h1 className="display-title mb-3 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
          {title}
        </h1>
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
          Last updated: {LEGAL_LAST_UPDATED}
        </p>
        <div className="mt-6 space-y-4 text-base leading-8 text-[var(--sea-ink-soft)]">
          {intro}
        </div>

        <nav
          aria-label="On this page"
          className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] p-4"
        >
          <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--kicker)]">
            Contents
          </p>
          <ol className="m-0 list-decimal space-y-1 pl-5 text-sm text-[var(--sea-ink)]">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-[var(--sea-ink)] underline decoration-[var(--sea-ink)]/30 underline-offset-2 hover:decoration-[var(--sea-ink)]"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="mb-3 text-xl font-bold text-[var(--sea-ink)]">
                {section.title}
              </h2>
              <div className="space-y-4 text-base leading-8 text-[var(--sea-ink-soft)]">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--line)] pt-6 text-sm">
          <Link
            to="/"
            className="font-medium text-[var(--sea-ink)] underline decoration-[var(--sea-ink)]/30 underline-offset-2 hover:decoration-[var(--sea-ink)]"
          >
            Home
          </Link>
          <Link
            to="/terms"
            className="font-medium text-[var(--sea-ink)] underline decoration-[var(--sea-ink)]/30 underline-offset-2 hover:decoration-[var(--sea-ink)]"
          >
            Terms of Service
          </Link>
          <Link
            to="/privacy"
            className="font-medium text-[var(--sea-ink)] underline decoration-[var(--sea-ink)]/30 underline-offset-2 hover:decoration-[var(--sea-ink)]"
          >
            Privacy Policy
          </Link>
        </footer>
      </article>
    </main>
  )
}
