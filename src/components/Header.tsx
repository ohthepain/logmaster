import { Link } from "@tanstack/react-router";
import { BookOpenText } from "lucide-react";
import { cn } from "../lib/cn";
import DevModeToggle from "./DevModeToggle";
import { DevComponentLabel } from "./DevComponentLabel";
import ThemeToggle from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export function AppHeaderBrand({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        "group flex shrink-0 items-center rounded-md text-[var(--sea-ink)] no-underline outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--brand)]/30 focus-visible:ring-offset-2",
        "focus-visible:ring-offset-[var(--bg-base)]",
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

export default function Header() {
  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--header-bg)_92%,transparent)] backdrop-blur-xl">
      <DevComponentLabel name="Header" className="absolute left-3 top-1 z-10 sm:left-4" />
      <div className="page-wrap flex min-h-16 items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <AppHeaderBrand />
        <div className="flex items-center gap-2">
          <Link
            to="/trips"
            className="hidden items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-xs font-semibold text-[var(--sea-ink)] no-underline transition hover:bg-[var(--link-bg-hover)] sm:inline-flex"
          >
            <BookOpenText className="size-4" />
            Trips
          </Link>
          <DevModeToggle />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
