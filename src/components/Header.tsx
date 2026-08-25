import { Link } from "@tanstack/react-router";
import { cn } from "../lib/cn";
import { TRIP_MAP_OVERLAY_HEADER_CLASS } from "../lib/trip-map-overlay";
import DevModeToggle from "./DevModeToggle";
import { DevComponentLabel } from "./DevComponentLabel";
import { HeaderNav } from "./HeaderNav";
import ThemeToggle from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

type HeaderProps = {
  mapOverlay?: boolean;
};

export function AppHeaderBrand({ className, mapOverlay = false }: { className?: string; mapOverlay?: boolean }) {
  return (
    <Link
      to="/"
      className={cn(
        "group flex shrink-0 items-center rounded-md no-underline outline-none",
        mapOverlay ? "text-white" : "text-[var(--sea-ink)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--brand)]/30 focus-visible:ring-offset-2",
        mapOverlay ? "focus-visible:ring-offset-transparent" : "focus-visible:ring-offset-[var(--bg-base)]",
        className,
      )}
      aria-label="logmaster home"
    >
      <img
        src="/logmaster_logo_trans_crop.png"
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0 object-contain"
        decoding="async"
      />
      <span className="leading-none">
        <span className="brand-title block text-lg tracking-tight sm:text-xl">logmaster</span>
      </span>
    </Link>
  );
}

export default function Header({ mapOverlay = false }: HeaderProps) {
  return (
    <header
      className={cn(
        "top-0 z-50 shrink-0 pt-[env(safe-area-inset-top,0px)]",
        mapOverlay
          ? cn("fixed inset-x-0", TRIP_MAP_OVERLAY_HEADER_CLASS)
          : "sticky border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--header-bg)_92%,transparent)] backdrop-blur-xl",
      )}
    >
      <DevComponentLabel name="Header" className="absolute left-3 top-1 z-10 sm:left-4" />
      <div className="page-wrap grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2 sm:px-4">
        {mapOverlay ? <div aria-hidden /> : <AppHeaderBrand />}
        <HeaderNav mapOverlay={mapOverlay} />
        <div className="flex items-center justify-end gap-2">
          <DevModeToggle mapOverlay={mapOverlay} />
          {!mapOverlay ? <ThemeToggle /> : null}
          <UserMenu mapOverlay={mapOverlay} />
        </div>
      </div>
    </header>
  );
}
