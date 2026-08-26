import { Toaster } from 'sonner'
import { APP_HEADER_TOP_OFFSET } from '../lib/safe-area'

const toastOffset = { top: APP_HEADER_TOP_OFFSET }

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      offset={toastOffset}
      mobileOffset={toastOffset}
      toastOptions={{
        classNames: {
          toast: 'app-toast',
        },
      }}
    />
  )
}
