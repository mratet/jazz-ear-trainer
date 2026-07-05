-- CreateEnum
CREATE TYPE "YoutubeStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'GEO_RESTRICTED', 'NOT_FOUND', 'UNCHECKED');

-- CreateEnum
CREATE TYPE "Format" AS ENUM ('VOCAL', 'VOCAL_TRIO', 'SOLO_PIANO', 'TRIO', 'QUARTET', 'QUINTET', 'BIG_BAND', 'OTHER');

-- CreateEnum
CREATE TYPE "Style" AS ENUM ('BEBOP', 'COOL_JAZZ', 'HARD_BOP', 'MODAL', 'BOSSA_NOVA', 'LATIN', 'BALLAD', 'SWING', 'FREE_JAZZ', 'FUSION', 'CONTEMPORARY', 'OTHER');

-- CreateEnum
CREATE TYPE "Era" AS ENUM ('ERA_1920S', 'ERA_1930S', 'ERA_1940S', 'ERA_1950S', 'ERA_1960S', 'ERA_1970S', 'ERA_1980S', 'ERA_1990S', 'ERA_2000S', 'ERA_2010S', 'ERA_2020S', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Standard" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "aliases" TEXT[],
    "composer" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Standard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Version" (
    "id" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT,
    "year" INTEGER,
    "shsId" TEXT,
    "youtubeUrl" TEXT,
    "youtubeStatus" "YoutubeStatus" NOT NULL DEFAULT 'UNCHECKED',
    "format" "Format",
    "style" "Style",
    "era" "Era",
    "key" TEXT,
    "titleOverride" TEXT,
    "themeTimecode" INTEGER,
    "lastFmTags" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Version_youtubeUrl_key" ON "Version"("youtubeUrl");

-- CreateIndex
CREATE INDEX "Version_standardId_idx" ON "Version"("standardId");

-- CreateIndex
CREATE INDEX "Version_youtubeStatus_idx" ON "Version"("youtubeStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Version_standardId_shsId_key" ON "Version"("standardId", "shsId");

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
