import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '../../components/LegalPage'
import {
  LEGAL_APP_NAME,
  LEGAL_CONTACT_EMAIL,
  legalCanonical,
} from '../../lib/legal'

export const Route = createFileRoute('/_main/terms')({
  head: () => ({
    meta: [
      { title: `Terms of Service · ${LEGAL_APP_NAME}` },
      {
        name: 'description',
        content: `Terms of Service for ${LEGAL_APP_NAME}, the offline-first sailing logbook.`,
      },
    ],
    links: [{ rel: 'canonical', href: legalCanonical('/terms') }],
  }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Terms of Service"
      intro={
        <>
          <p className="m-0">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to
            and use of {LEGAL_APP_NAME} at{' '}
            <a
              href={legalCanonical('/')}
              className="text-[var(--sea-ink)] underline decoration-[var(--sea-ink)]/30 underline-offset-2"
            >
              {legalCanonical('/')}
            </a>{' '}
            and related apps (the &ldquo;Service&rdquo;). By using the Service,
            you agree to these Terms.
          </p>
          <p className="m-0">
            If you do not agree, do not use the Service. These Terms are written
            for clarity; they are not legal advice.
          </p>
        </>
      }
      sections={[
        {
          id: 'service',
          title: '1. The Service',
          content: (
            <>
              <p className="m-0">
                {LEGAL_APP_NAME} is a sailing logbook that lets you record
                trips, events, notes, and media. The Service is designed to work
                offline first and sync when connectivity is available.
              </p>
              <p className="m-0">
                You may use much of the Service without an account. Creating an
                account enables cross-device sync and related features.
              </p>
            </>
          ),
        },
        {
          id: 'accounts',
          title: '2. Accounts and eligibility',
          content: (
            <>
              <p className="m-0">
                You must be able to form a binding contract in your jurisdiction
                to create an account. You are responsible for keeping your
                sign-in credentials secure and for activity under your account.
              </p>
              <p className="m-0">
                You agree to provide accurate account information and to notify
                us if you suspect unauthorized access.
              </p>
            </>
          ),
        },
        {
          id: 'your-content',
          title: '3. Your content',
          content: (
            <>
              <p className="m-0">
                You retain ownership of the log entries, notes, photos, and other
                content you submit (&ldquo;User Content&rdquo;). You grant us a
                limited license to host, store, process, and display User
                Content only as needed to operate and improve the Service,
                including syncing it across your devices when you are signed in.
              </p>
              <p className="m-0">
                You are responsible for User Content and must have the rights
                needed to upload it. Do not upload content that infringes
                others&rsquo; rights or violates applicable law.
              </p>
            </>
          ),
        },
        {
          id: 'acceptable-use',
          title: '4. Acceptable use',
          content: (
            <>
              <p className="m-0">You agree not to:</p>
              <ul className="m-0 list-disc space-y-2 pl-5">
                <li>use the Service for unlawful, harmful, or abusive purposes;</li>
                <li>
                  attempt to access accounts or systems without authorization;
                </li>
                <li>
                  interfere with or disrupt the Service, including by automated
                  scraping or excessive load;
                </li>
                <li>
                  reverse engineer or attempt to extract source code except
                  where permitted by law.
                </li>
              </ul>
              <p className="m-0">
                We may suspend or terminate access if we reasonably believe you
                have violated these Terms or pose a risk to the Service or other
                users.
              </p>
            </>
          ),
        },
        {
          id: 'navigation',
          title: '5. Navigation and safety',
          content: (
            <>
              <p className="m-0">
                {LEGAL_APP_NAME} is a logbook, not a chart plotter or navigation
                aid. Maps, location data, and weather information may be
                incomplete, delayed, or inaccurate. You are solely responsible
                for safe vessel operation and compliance with applicable
                navigation rules and regulations.
              </p>
              <p className="m-0">
                Do not rely on the Service as your primary means of navigation
                or safety at sea.
              </p>
            </>
          ),
        },
        {
          id: 'third-party',
          title: '6. Third-party services',
          content: (
            <>
              <p className="m-0">
                The Service may integrate with third-party providers (for
                example, sign-in providers, map tile services, cloud hosting,
                and email delivery). Your use of those services may be subject
                to their separate terms and policies.
              </p>
              <p className="m-0">
                We are not responsible for third-party services outside our
                reasonable control.
              </p>
            </>
          ),
        },
        {
          id: 'availability',
          title: '7. Availability and changes',
          content: (
            <>
              <p className="m-0">
                We aim to keep the Service available and useful, but we do not
                guarantee uninterrupted or error-free operation. Features may
                change, and we may modify or discontinue parts of the Service
                with reasonable notice where practicable.
              </p>
              <p className="m-0">
                We may update these Terms from time to time. Material changes
                will be reflected by updating the &ldquo;Last updated&rdquo;
                date on this page. Continued use after changes become effective
                constitutes acceptance of the revised Terms.
              </p>
            </>
          ),
        },
        {
          id: 'disclaimers',
          title: '8. Disclaimers',
          content: (
            <p className="m-0">
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
              AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS
              OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE
              MAXIMUM EXTENT PERMITTED BY LAW.
            </p>
          ),
        },
        {
          id: 'liability',
          title: '9. Limitation of liability',
          content: (
            <p className="m-0">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR
              ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
              DAMAGES, OR ANY LOSS OF DATA, PROFITS, GOODWILL, OR VESSEL
              OPERATIONS, ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE.
              OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS OR
              THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU
              PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM OR
              (B) USD $100, EXCEPT WHERE LIABILITY CANNOT BE LIMITED BY LAW.
            </p>
          ),
        },
        {
          id: 'termination',
          title: '10. Termination',
          content: (
            <>
              <p className="m-0">
                You may stop using the Service at any time. We may suspend or
                terminate your access if you breach these Terms or if required
                for legal, security, or operational reasons.
              </p>
              <p className="m-0">
                Sections that by their nature should survive termination
                (including ownership, disclaimers, and limitations of liability)
                will survive.
              </p>
            </>
          ),
        },
        {
          id: 'contact',
          title: '11. Contact',
          content: (
            <p className="m-0">
              Questions about these Terms:{' '}
              <a
                href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                className="text-[var(--sea-ink)] underline decoration-[var(--sea-ink)]/30 underline-offset-2"
              >
                {LEGAL_CONTACT_EMAIL}
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  )
}
