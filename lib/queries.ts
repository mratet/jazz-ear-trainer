import { db } from "@/lib/db";
import type { YoutubeStatus } from "@/app/generated/prisma";

export async function getAvailableVersions(standardId: string) {
  return db.version.findMany({
    where: { standardId, youtubeStatus: "AVAILABLE" },
  });
}

export async function getStandardsByIds(ids: string[]) {
  return db.standard.findMany({
    where: { id: { in: ids } },
    include: { versions: { where: { youtubeStatus: "AVAILABLE" } } },
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
