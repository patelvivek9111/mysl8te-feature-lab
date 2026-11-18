-- AlterTable
ALTER TABLE "ai_assessments" ADD COLUMN     "review_decision" TEXT,
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "ai_assessments" ADD CONSTRAINT "ai_assessments_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

