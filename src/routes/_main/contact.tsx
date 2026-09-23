import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowUpRight, Mail } from 'lucide-react'
import { PublicPage } from '../../components/PublicPage'
import { LEGAL_CONTACT_EMAIL, legalCanonical } from '../../lib/legal'

export const Route = createFileRoute('/_main/contact')({
  head: () => ({
    meta: [
      { title: 'Contact & Support — Logmaster' },
      {
        name: 'description',
        content:
          'Get help with Logmaster, report a problem, share feedback, or ask about your account and data.',
      },
    ],
    links: [{ rel: 'canonical', href: legalCanonical('/contact') }],
  }),
  component: Contact,
})

function Contact() {
  return (
    <PublicPage>
      <div className="mx-auto max-w-3xl">
        <p className="island-kicker mb-4">Contact & support</p>
        <h1 className="display-title text-4xl leading-tight sm:text-6xl">
          A little help for your next chapter.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--sea-ink-soft)]">
          Need help with Logmaster, found a problem, or have an idea to share?
          Get in touch with Paul Wilkinson.
        </p>
        <section
          className="my-10 rounded-3xl border border-[var(--line)] bg-[var(--chip-bg)] p-6 sm:p-9"
          aria-labelledby="email-title"
        >
          <Mail
            size={28}
            className="mb-5 text-[color:var(--brand)]"
            aria-hidden="true"
          />
          <h2 id="email-title" className="text-xl font-bold">
            Email us
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--sea-ink-soft)]">
            For app support, feedback, feature requests, and questions about
            your account or data.
          </p>
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}?subject=Logmaster%20support`}
            className="mt-5 inline-flex max-w-full items-center gap-2 break-all text-lg font-semibold underline underline-offset-4 sm:text-2xl"
          >
            {LEGAL_CONTACT_EMAIL}
            <ArrowUpRight size={20} className="shrink-0" aria-hidden="true" />
          </a>
          <p className="mt-4 text-sm text-[var(--sea-ink-soft)]">
            Your email app will open. You can also copy the address into your
            preferred email service.
          </p>
        </section>
        <section className="border-b border-[var(--line)] pb-9">
          <h2 className="display-title text-2xl">
            Help us understand the problem
          </h2>
          <p className="mt-3 leading-7 text-[var(--sea-ink-soft)]">
            If something isn’t working, please include:
          </p>
          <ul className="mt-4 list-disc space-y-3 pl-5 leading-7 text-[var(--sea-ink-soft)]">
            <li>What you were trying to do, and what happened instead.</li>
            <li>
              Your device model and iOS version, or browser if you use the
              website.
            </li>
            <li>The app version and a screenshot, if available.</li>
          </ul>
          <p className="mt-4 text-sm leading-7 text-[var(--sea-ink-soft)]">
            Please leave passwords and other sensitive information out of your
            message.
          </p>
        </section>
        <section className="pt-9">
          <h2 className="display-title text-2xl">Your account and privacy</h2>
          <p className="mt-3 leading-7 text-[var(--sea-ink-soft)]">
            Use the same email address above for account help, data requests, or
            account deletion. Contact us from the email linked to your account
            so we can help identify it.
          </p>
          <div className="mt-5 flex flex-wrap gap-5 text-sm font-semibold">
            <Link to="/privacy" className="underline underline-offset-4">
              Privacy Policy
            </Link>
            <Link to="/terms" className="underline underline-offset-4">
              Terms of Service
            </Link>
          </div>
        </section>
      </div>
    </PublicPage>
  )
}
