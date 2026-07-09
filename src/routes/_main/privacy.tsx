import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '../../components/LegalPage'
import {
  LEGAL_APP_NAME,
  LEGAL_CONTACT_EMAIL,
  legalCanonical,
} from '../../lib/legal'

export const Route = createFileRoute('/_main/privacy')({
  head: () => ({
    meta: [
      { title: `Privacy Policy · ${LEGAL_APP_NAME}` },
      {
        name: 'description',
        content: `Privacy Policy for ${LEGAL_APP_NAME}, the offline-first sailing logbook.`,
      },
    ],
    links: [{ rel: 'canonical', href: legalCanonical('/privacy') }],
  }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Privacy Policy"
      intro={
        <>
          <p className="m-0">
            This Privacy Policy explains how {LEGAL_APP_NAME} (&ldquo;we&rdquo;,
            &ldquo;us&rdquo;) collects, uses, and shares information when you
            use our website, progressive web app, and related services (the
            &ldquo;Service&rdquo;) at{' '}
            <a
              href={legalCanonical('/')}
              className="text-[var(--sea-ink)] underline decoration-[var(--sea-ink)]/30 underline-offset-2"
            >
              {legalCanonical('/')}
            </a>
            .
          </p>
          <p className="m-0">
            You can use much of the Service without signing in. When you create
            an account, we process additional information to authenticate you
            and sync your data.
          </p>
        </>
      }
      sections={[
        {
          id: 'information-we-collect',
          title: '1. Information we collect',
          content: (
            <>
              <p className="m-0 font-medium text-[var(--sea-ink)]">
                Account information
              </p>
              <p className="m-0">
                If you register or sign in, we may collect your name, email
                address, profile photo (if provided), and authentication
                details. If you use Google sign-in, we receive basic profile
                information from Google according to your Google account
                settings.
              </p>
              <p className="m-0 font-medium text-[var(--sea-ink)]">
                Logbook and user content
              </p>
              <p className="m-0">
                When you use the Service, you may submit trip records, log
                entries, notes, timestamps, optional location coordinates,
                heading/accuracy metadata, weather metadata, boat names, and
                photos you upload. Some of this may be stored on your device
                before it syncs to our servers.
              </p>
              <p className="m-0 font-medium text-[var(--sea-ink)]">
                Device and usage information
              </p>
              <p className="m-0">
                We may collect technical information such as browser type, app
                version, IP address, and session identifiers for security,
                debugging, and service operation. Session records may include IP
                address and user agent when you are signed in.
              </p>
            </>
          ),
        },
        {
          id: 'local-first',
          title: '2. Local-first storage',
          content: (
            <>
              <p className="m-0">
                {LEGAL_APP_NAME} is designed to work offline. Trip and log data
                may remain on your device until you are online and choose to
                sync (or until sync runs in the background). Data on your device
                is subject to your device&rsquo;s own security settings.
              </p>
              <p className="m-0">
                Clearing site data or uninstalling the app may remove locally
                stored information that has not yet synced.
              </p>
            </>
          ),
        },
        {
          id: 'how-we-use',
          title: '3. How we use information',
          content: (
            <>
              <p className="m-0">We use information to:</p>
              <ul className="m-0 list-disc space-y-2 pl-5">
                <li>provide, maintain, and improve the Service;</li>
                <li>authenticate you and sync your logbook across devices;</li>
                <li>store and display your trips, entries, boats, and media;</li>
                <li>
                  send transactional emails (for example, sign-in links,
                  verification, and password reset messages);
                </li>
                <li>protect the Service, investigate abuse, and comply with law;</li>
                <li>understand usage and fix errors.</li>
              </ul>
              <p className="m-0">
                We do not sell your personal information.
              </p>
            </>
          ),
        },
        {
          id: 'sharing',
          title: '4. How we share information',
          content: (
            <>
              <p className="m-0">
                We share information only as needed to operate the Service,
                including with service providers that process data on our
                behalf, such as:
              </p>
              <ul className="m-0 list-disc space-y-2 pl-5">
                <li>cloud hosting and database providers;</li>
                <li>object storage for uploaded photos;</li>
                <li>email delivery for account-related messages;</li>
                <li>map tile providers when you use map features;</li>
                <li>authentication providers if you choose social sign-in.</li>
              </ul>
              <p className="m-0">
                We may also disclose information if required by law, to protect
                rights and safety, or in connection with a merger, acquisition,
                or asset sale, subject to appropriate safeguards.
              </p>
            </>
          ),
        },
        {
          id: 'retention',
          title: '5. Data retention',
          content: (
            <>
              <p className="m-0">
                We retain account and synced logbook data while your account is
                active or as needed to provide the Service. You may request
                deletion of your account and associated server-side data by
                contacting us.
              </p>
              <p className="m-0">
                We may retain limited information for legal, security, or backup
                purposes for a reasonable period after deletion.
              </p>
            </>
          ),
        },
        {
          id: 'security',
          title: '6. Security',
          content: (
            <p className="m-0">
              We use reasonable technical and organizational measures to protect
              information, including encryption in transit (HTTPS) and access
              controls on our infrastructure. No method of transmission or
              storage is completely secure; we cannot guarantee absolute
              security.
            </p>
          ),
        },
        {
          id: 'your-rights',
          title: '7. Your choices and rights',
          content: (
            <>
              <p className="m-0">Depending on where you live, you may have the right to:</p>
              <ul className="m-0 list-disc space-y-2 pl-5">
                <li>access, correct, or delete personal information we hold;</li>
                <li>object to or restrict certain processing;</li>
                <li>withdraw consent where processing is consent-based;</li>
                <li>lodge a complaint with a supervisory authority.</li>
              </ul>
              <p className="m-0">
                To exercise these rights, contact us at the email below. We may
                need to verify your request.
              </p>
            </>
          ),
        },
        {
          id: 'children',
          title: '8. Children',
          content: (
            <p className="m-0">
              The Service is not directed to children under 13 (or the minimum
              age required in your country). We do not knowingly collect
              personal information from children. If you believe a child has
              provided us personal information, contact us and we will take
              appropriate steps to delete it.
            </p>
          ),
        },
        {
          id: 'international',
          title: '9. International users',
          content: (
            <p className="m-0">
              We may process and store information in countries other than where
              you live. Those countries may have different data protection laws.
              By using the Service, you understand that your information may be
              transferred and processed in those locations.
            </p>
          ),
        },
        {
          id: 'changes',
          title: '10. Changes to this policy',
          content: (
            <p className="m-0">
              We may update this Privacy Policy from time to time. We will post
              the revised policy on this page and update the &ldquo;Last
              updated&rdquo; date. Material changes may also be communicated
              through the Service where appropriate.
            </p>
          ),
        },
        {
          id: 'contact',
          title: '11. Contact',
          content: (
            <p className="m-0">
              Privacy questions or requests:{' '}
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
