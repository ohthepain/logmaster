import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { AllNotificationsPausedBanner } from "../../../components/AllNotificationsPausedBanner";
import { GlobalNotificationPreferenceBell } from "../../../components/GlobalNotificationPreferenceBell";
import { NotificationSettingsPanel } from "../../../components/NotificationSettingsPanel";

export const Route = createFileRoute("/_main/settings/notifications")({
  head: () => ({
    meta: [{ title: "Notification settings · Logmaster" }],
  }),
  component: NotificationsSettingsPage,
});

function NotificationsSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Back
      </Link>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-semibold text-[var(--sea-ink)]">Notifications settings</h1>
        </div>
        <GlobalNotificationPreferenceBell />
      </div>
      <AllNotificationsPausedBanner className="mb-4" />
      <NotificationSettingsPanel />
    </div>
  );
}
