ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'PRODUCT_DELETION_SCHEDULED';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'PRODUCT_DELETION_CANCELLED';

ALTER TABLE "Product"
ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN "deletionScheduledFor" TIMESTAMP(3),
ADD COLUMN "deletionRequestedById" UUID;

CREATE INDEX "Product_deletionScheduledFor_idx" ON "Product"("deletionScheduledFor");
