import { useRouterState } from '@tanstack/react-router'
import Header from './Header'
import { BackgroundTripRecorder } from './BackgroundTripRecorder'
import { FtueGate } from './FtueGate'

const NO_CHROME = new Set(['/sign-in', '/reset-password'])

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hideChrome =
    NO_CHROME.has(pathname) || pathname.startsWith('/crew/invite/')
  return (
    <FtueGate>
      <BackgroundTripRecorder />
      {hideChrome ? (
        children
      ) : (
        <>
          <Header />
          {children}
        </>
      )}
    </FtueGate>
  )
}
