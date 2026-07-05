import { db } from "@/lib/db";
import type { YoutubeStatus } from "@prisma/client";

export async function getAllVersionsForGame() {
  return db.version.findMany({
    where: { youtubeStatus: { in: ["AVAILABLE", "UNCHECKED"] } },
    select: { id: true, standardId: true },
  });
}

export async function getVersionById(id: string) {
  return db.version.findUnique({
    where: { id },
    include: { standard: true },
  });
}

export async function getCatalogue() {
  return db.standard.findMany({
    select: { id: true, title: true, aliases: true },
    orderBy: { title: "asc" },
  });
}

export async function getVersionsWithStandardByIds(ids: string[]) {
  return db.version.findMany({
    where: { id: { in: ids } },
    include: { standard: true },
  });
}

export async function getAvailableVersions(standardId: string) {
  return db.version.findMany({
    where: { standardId, youtubeStatus: "AVAILABLE" },
  });
}

export async function getAllStandards() {
  return db.standard.findMany({
    include: { versions: { where: { youtubeStatus: "AVAILABLE" } } },
    orderBy: { title: "asc" },
  });
}

export async function markVersionUnavailable(versionId: string, status: YoutubeStatus = "UNAVAILABLE") {
  return db.version.update({
    where: { id: versionId },
    data: { youtubeStatus: status },
  });
}
