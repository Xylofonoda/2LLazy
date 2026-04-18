-- CreateTable
CREATE TABLE "RoleProfile" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "antiQuery" TEXT NOT NULL,
    "embedding" vector(1536),
    "antiEmbedding" vector(1536),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "RoleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleProfile_category_key" ON "RoleProfile"("category");
