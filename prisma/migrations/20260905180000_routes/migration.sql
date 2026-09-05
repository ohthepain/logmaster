-- CreateEnum
CREATE TYPE "RouteCoverKind" AS ENUM ('photo', 'map');

-- CreateEnum
CREATE TYPE "RouteAnnotationKind" AS ENUM ('comment', 'photo');

-- CreateEnum
CREATE TYPE "RouteMediaType" AS ENUM ('photo', 'attachment');

-- CreateTable
CREATE TABLE "route" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "boatId" TEXT,
    "coverKind" "RouteCoverKind",
    "coverPhotoDataUrl" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "synced" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_waypoint" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "symbol" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "synced" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "route_waypoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_annotation" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "waypointId" TEXT,
    "kind" "RouteAnnotationKind" NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "synced" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "route_annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_media" (
    "id" TEXT NOT NULL,
    "annotationId" TEXT NOT NULL,
    "type" "RouteMediaType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "localPath" TEXT,
    "remoteUrl" TEXT,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "synced" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "route_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deleted_route" (
    "id" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_route_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_updatedAt_idx" ON "route"("updatedAt");

-- CreateIndex
CREATE INDEX "route_waypoint_routeId_sequence_idx" ON "route_waypoint"("routeId", "sequence");

-- CreateIndex
CREATE INDEX "route_annotation_routeId_createdAt_idx" ON "route_annotation"("routeId", "createdAt");

-- CreateIndex
CREATE INDEX "route_annotation_synced_updatedAt_idx" ON "route_annotation"("synced", "updatedAt");

-- CreateIndex
CREATE INDEX "route_media_annotationId_order_idx" ON "route_media"("annotationId", "order");

-- CreateIndex
CREATE INDEX "route_media_synced_updatedAt_idx" ON "route_media"("synced", "updatedAt");

-- AddForeignKey
ALTER TABLE "route_waypoint" ADD CONSTRAINT "route_waypoint_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_annotation" ADD CONSTRAINT "route_annotation_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_annotation" ADD CONSTRAINT "route_annotation_waypointId_fkey" FOREIGN KEY ("waypointId") REFERENCES "route_waypoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_media" ADD CONSTRAINT "route_media_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "route_annotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
