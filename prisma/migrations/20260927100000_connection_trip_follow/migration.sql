ALTER TABLE "user_connection" ADD COLUMN "notifyInviteeOnTripStart" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_connection" ADD COLUMN "notifyOnInviterTripStart" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "connection_invite" ADD COLUMN "notifyInviteeOnTripStart" BOOLEAN NOT NULL DEFAULT true;

ALTER TYPE "NotificationTopic" ADD VALUE 'CONNECTION_TRIP_STARTED';
