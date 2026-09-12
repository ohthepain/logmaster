import {
  HeadContent,
  Outlet,
  Scripts,
  createFileRoute,
} from '@tanstack/react-router'
import { AppShell } from '../../components/AppShell'
import { AppToaster } from '../../components/AppToaster'
import { DevTanStackDevtools } from '../../components/DevTanStackDevtools'
import { NativeAppLinks } from '../../components/NativeAppLinks'
import { PwaRegister } from '../../components/PwaRegister'
import { PushNotificationsRegister } from '../../components/PushNotificationsRegister'
import { I18nProvider } from '../../lib/i18n'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createFileRoute('/_main')({
  component: MainLayout,
})

function MainLayout() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[var(--brand-muted)]">
        <I18nProvider>
          <PwaRegister />
          <PushNotificationsRegister />
          <NativeAppLinks />
          <AppShell>
            <Outlet />
          </AppShell>
          <AppToaster />
          <DevTanStackDevtools />
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  )
}
