-- CreateTable
CREATE TABLE "admin_job_log" (
    "jobId" TEXT NOT NULL,
    "log" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_job_log_pkey" PRIMARY KEY ("jobId")
);
