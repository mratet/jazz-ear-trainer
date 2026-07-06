import { db, closeDb } from "./_db";
import type { YoutubeStatus } from "@prisma/client";

const OEMBED_URL = "https://www.youtube.com/oembed?format=json&url=";

async function checkUrl(url: string): Promise<YoutubeStatus> {
  try {
    const res = await fetch(`${OEMBED_URL}${encodeURIComponent(url)}`);
    if (res.ok) return "AVAILABLE";
    if (res.status === 403) return "GEO_RESTRICTED";
    if (res.status === 404) return "NOT_FOUND";
    return "UNAVAILABLE";
  } catch {
    return "UNAVAILABLE";
  }
}

async function main() {
  const versions = await db.version.findMany({
    where: { youtubeUrl: { not: null } },
    select: { id: true, youtubeUrl: true, youtubeStatus: true },
  });

  console.log(`Vérification de ${versions.length} enregistrement(s)…\n`);

  const counts: Record<YoutubeStatus, number> = {
    AVAILABLE: 0,
    UNAVAILABLE: 0,
    GEO_RESTRICTED: 0,
    NOT_FOUND: 0,
    UNCHECKED: 0,
  };

  for (const v of versions) {
    const status = await checkUrl(v.youtubeUrl!);
    if (status !== v.youtubeStatus) {
      await db.version.update({
        where: { id: v.id },
        data: { youtubeStatus: status },
      });
      console.log(`  ${v.id.slice(0, 8)}… ${v.youtubeStatus} → ${status}`);
    }
    counts[status]++;
  }

  console.log("\nRésumé :");
  for (const [status, count] of Object.entries(counts)) {
    if (count > 0) console.log(`  ${status}: ${count}`);
  }

  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
