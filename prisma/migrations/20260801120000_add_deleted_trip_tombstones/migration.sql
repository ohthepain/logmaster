-- CreateTable
CREATE TABLE "deleted_trip" (
    "id" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_trip_pkey" PRIMARY KEY ("id")
);
