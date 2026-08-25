import { operationalToggleTooltip } from "../domain/trip-state";
import type { OperationalToggle } from "../domain/trip-state";
import {
  MAP_CHROME_BUTTON_HOVER_CLASS,
  MAP_CHROME_DIVIDER_CLASS,
  MAP_CHROME_OPERATIONAL_CELL_CLASS,
  MAP_CHROME_OPERATIONAL_ICON_CLASS,
} from "../lib/map-chrome";
import { cn } from "../lib/cn";
import { MapButtonTooltip } from "./MapButtonTooltip";

const TOGGLE_IMAGES: Record<OperationalToggle, { on: string; off: string }> = {
  sails: {
    on: "/buttons/sails-up-v2.png",
    off: "/buttons/sails-down-v2.png",
  },
  engine: {
    on: "/buttons/engine-on-white.png",
    off: "/buttons/engine-off-white.png",
  },
  moored: {
    on: "/buttons/moored-white.png",
    off: "/buttons/unmoored-white.png",
  },
  anchor: {
    on: "/buttons/anchor-down-white.png",
    off: "/buttons/anchor-up-white.png",
  },
};

type OperationalToggleButtonProps = {
  toggle: OperationalToggle;
  checked: boolean;
  pending?: boolean;
  disabled?: boolean;
  bordered?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function OperationalToggleButton({
  toggle,
  checked,
  pending: _pending = false,
  disabled = false,
  bordered = false,
  onCheckedChange,
}: OperationalToggleButtonProps) {
  const tooltip = operationalToggleTooltip(toggle, checked);
  const images = TOGGLE_IMAGES[toggle];

  return (
    <MapButtonTooltip label={tooltip}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={tooltip}
        title={tooltip}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          MAP_CHROME_OPERATIONAL_CELL_CLASS,
          "overflow-hidden",
          MAP_CHROME_BUTTON_HOVER_CLASS,
          bordered && MAP_CHROME_DIVIDER_CLASS,
          !disabled && "hover:border-[rgba(126,200,232,0.35)]",
          disabled && "cursor-default",
        )}
      >
        <img
          src={checked ? images.on : images.off}
          alt=""
          width={44}
          height={44}
          decoding="async"
          draggable={false}
          className={cn("size-full object-contain p-0.5", MAP_CHROME_OPERATIONAL_ICON_CLASS)}
        />
      </button>
    </MapButtonTooltip>
  );
}
