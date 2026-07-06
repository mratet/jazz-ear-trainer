import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";
import { db, closeDb } from "./_db";
import type { Style, Format, Era } from "@prisma/client";

const VersionOverrideSchema = z.object({
  key: z.string().optional(),
  style: z.nativeEnum({ BEBOP: "BEBOP", COOL_JAZZ: "COOL_JAZZ", HARD_BOP: "HARD_BOP", MODAL: "MODAL", BOSSA_NOVA: "BOSSA_NOVA", LATIN: "LATIN", BALLAD: "BALLAD", SWING: "SWING", FREE_JAZZ: "FREE_JAZZ", FUSION: "FUSION", CONTEMPORARY: "CONTEMPORARY", OTHER: "OTHER" } as const).optional(),
  format: z.nativeEnum({ VOCAL: "VOCAL", VOCAL_TRIO: "VOCAL_TRIO", SOLO_PIANO: "SOLO_PIANO", TRIO: "TRIO", QUARTET: "QUARTET", QUINTET: "QUINTET", BIG_BAND: "BIG_BAND", OTHER: "OTHER" } as const).optional(),
  era: z.nativeEnum({ ERA_1920S: "ERA_1920S", ERA_1930S: "ERA_1930S", ERA_1940S: "ERA_1940S", ERA_1950S: "ERA_1950S", ERA_1960S: "ERA_1960S", ERA_1970S: "ERA_1970S", ERA_1980S: "ERA_1980S", ERA_1990S: "ERA_1990S", ERA_2000S: "ERA_2000S", ERA_2010S: "ERA_2010S", ERA_2020S: "ERA_2020S", UNKNOWN: "UNKNOWN" } as const).optional(),
  themeTimecode: z.number().int().min(0).optional(),
  titleOverride: z.string().optional(),
});

const StandardOverrideSchema = z.object({
  composer: z.string().optional(),
  year: z.number().int().optional(),
  key: z.string().optional(),
  aliases: z.array(z.string()).optional(),
});

const OverridesSchema = z.object({
  versions: z.record(z.string(), VersionOverrideSchema).default({}),
  standards: z.record(z.string(), StandardOverrideSchema).default({}),
});

async function main() {
  const overridesPath = join(process.cwd(), "data", "manual-overrides.json");
  const raw = JSON.parse(readFileSync(overridesPath, "utf-8"));
  const overrides = OverridesSchema.parse(raw);

  const versionEntries = Object.entries(overrides.versions);
  const standardEntries = Object.entries(overrides.standards);

  console.log(
    `Application des overrides : ${versionEntries.length} version(s), ${standardEntries.length} standard(s)\n`
  );

  let versionCount = 0;
  for (const [youtubeUrl, data] of versionEntries) {
    const version = await db.version.findUnique({ where: { youtubeUrl } });
    if (!version) {
      console.warn(`  ✗ Version introuvable pour : ${youtubeUrl}`);
      continue;
    }
    await db.version.update({
      where: { youtubeUrl },
      data: data as { key?: string; style?: Style; format?: Format; era?: Era; themeTimecode?: number; titleOverride?: string },
    });
    console.log(`  ✓ Version ${version.id.slice(0, 8)}… mis à jour`);
    versionCount++;
  }

  let standardCount = 0;
  for (const [id, data] of standardEntries) {
    const standard = await db.standard.findUnique({ where: { id } });
    if (!standard) {
      console.warn(`  ✗ Standard introuvable : ${id}`);
      continue;
    }
    await db.standard.update({ where: { id }, data });
    console.log(`  ✓ Standard "${id}" mis à jour`);
    standardCount++;
  }

  console.log(`\nAppliqué : ${versionCount} version(s), ${standardCount} standard(s)`);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
