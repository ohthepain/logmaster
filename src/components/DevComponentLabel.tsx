import { cn } from '../lib/cn'
import { isDevModeAvailable } from '../lib/dev-mode'
import { useAppOptionsStore } from '../stores/app-options'

type DevComponentLabelProps = {
  name: string
  className?: string
}

export function DevComponentLabel({ name, className }: DevComponentLabelProps) {
  const devMode = useAppOptionsStore((state) => state.devMode)
  if (!devMode || !isDevModeAvailable()) return null

  return (
    <div
      className={cn('dev-component-label', className)}
      data-dev-component={name}
      aria-hidden
    >
      {name}
    </div>
  )
}
