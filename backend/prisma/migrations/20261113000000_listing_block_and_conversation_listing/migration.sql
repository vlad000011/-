ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';
ALTER TABLE "Conversation" ADD COLUMN "listingId" TEXT;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Conversation_listingId_idx" ON "Conversation"("listingId");
