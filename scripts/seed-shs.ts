/**
 * Peuple la base de données depuis l'API SecondHandSongs.
 *
 * Prérequis : SHS_API_KEY défini dans .env.local
 *
 * Usage :
 *   pnpm run seed:shs
 *   pnpm run seed:shs -- --standard autumn-leaves  (un seul standard)
 *
 * Pipeline complet recommandé après le seed :
 *   pnpm run check && pnpm run fetch:lastfm && pnpm run apply:overrides
 */

import { z } from "zod";
import Fuse from "fuse.js";
import standardsData from "../data/standards.json";
import { db, closeDb } from "./_db";

// ---------------------------------------------------------------------------
// SHS API — schémas de validation
// Ces schémas sont basés sur la documentation SHS API v1.
// À vérifier/ajuster selon la réponse réelle si des champs diffèrent.
// ---------------------------------------------------------------------------

const SHS_BASE = "https://secondhandsongs.com/api/v1";
const RATE_LIMIT_MS = 500;

const ShsArtistSchema = z.object({
  uri: z.string().optional(),
  commonName: z.string().optional(),
  name: z.string().optional(),
});

const ShsWorkSchema = z
  .object({
    uri: z.string(),
    title: z.string(),
    performer: ShsArtistSchema.optional(),
    credits: z
      .array(
        z.object({
          performer: ShsArtistSchema.optional(),
          role: z.string().optional(),
        })
      )
      .optional(),
    year: z.string().or(z.number()).optional(),
  })
  .passthrough();

const ShsExternalSchema = z.object({
  uri: z.string().optional(),
  url: z.string().optional(),
  service: z.string().optional(),
  type: z.string().optional(),
});

const ShsPerformanceSchema = z
  .object({
    uri: z.string(),
    title: z.string().optional(),
    performer: ShsArtistSchema,
    date: z.string().optional(),
    releasedOn: z
      .object({ title: z.string().optional(), year: z.string().or(z.number()).optional() })
      .optional(),
    external: z.array(ShsExternalSchema).optional(),
  })
  .passthrough();

const ShsSearchResponseSchema = z
  .object({
    resultCount: z.number().optional(),
    pageCount: z.number().optional(),
    result: z.array(ShsWorkSchema).optional(),
  })
  .passthrough();

const ShsVersionsResponseSchema = z
  .object({
    resultCount: z.number().optional(),
    result: z.array(ShsPerformanceSchema).optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function shsGet<T>(
  path: string,
  apiKey: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  const url = `${SHS_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.warn(`    SHS ${res.status} : ${url}`);
    return null;
  }

  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    console.warn(`    Réponse inattendue de SHS : ${JSON.stringify(json).slice(0, 200)}`);
    return null;
  }
  return parsed.data;
}

function extractYouTubeUrl(
  external: z.infer<typeof ShsExternalSchema>[]
): string | null {
  for (const link of external) {
    const url = link.url ?? link.uri ?? "";
    if (
      url.includes("youtube.com") ||
      url.includes("youtu.be") ||
      link.service?.toLowerCase().includes("youtube") ||
      link.type?.toLowerCase().includes("youtube")
    ) {
      return url;
    }
  }
  return null;
}

function getComposerName(work: z.infer<typeof ShsWorkSchema>): string {
  const credit = work.credits?.find(
    (c) => c.role?.toLowerCase().includes("compos") || c.role?.toLowerCase().includes("writ")
  );
  const name =
    credit?.performer?.commonName ??
    credit?.performer?.name ??
    work.performer?.commonName ??
    work.performer?.name ??
    "";
  return name;
}

function extractShsId(uri: string): string {
  return uri.split("/").pop() ?? uri;
}

function parseYear(raw: string | number | undefined): number | null {
  if (!raw) return null;
  const n = typeof raw === "number" ? raw : parseInt(String(raw).slice(0, 4), 10);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Recherche du Work SHS correspondant à un standard
// ---------------------------------------------------------------------------

async function findShsWork(
  standard: (typeof standardsData)[number],
  apiKey: string
): Promise<z.infer<typeof ShsWorkSchema> | null> {
  const query = encodeURIComponent(standard.title);

  // TODO: ajuster l'endpoint selon la doc réelle SHS API v1
  // Essai 1 : recherche par titre
  const resp = await shsGet(
    `/search?q=${query}&type=work&page=1`,
    apiKey,
    ShsSearchResponseSchema
  );

  const results = resp?.result ?? [];
  if (results.length === 0) return null;

  // Fuzzy match sur le nom du compositeur pour trouver le bon Work
  const fuse = new Fuse(results, {
    keys: ["title"],
    threshold: 0.3,
    includeScore: true,
  });

  const titleMatches = fuse.search(standard.title).map((r) => r.item);
  const candidates = titleMatches.length > 0 ? titleMatches : results;

  // Parmi les candidats, trouver celui dont le compositeur correspond
  const composerFuse = new Fuse(candidates.map((c) => ({ ...c, _composer: getComposerName(c) })), {
    keys: ["_composer"],
    threshold: 0.4,
  });

  const composerMatch = composerFuse.search(standard.composer)[0];
  return composerMatch?.item ?? candidates[0] ?? null;
}

// ---------------------------------------------------------------------------
// Seed d'un standard
// ---------------------------------------------------------------------------

async function seedStandard(
  standard: (typeof standardsData)[number],
  apiKey: string
): Promise<{ created: number; updated: number; noYoutube: number }> {
  const stats = { created: 0, updated: 0, noYoutube: 0 };

  // 1. Upsert le Standard en base
  await db.standard.upsert({
    where: { id: standard.id },
    create: {
      id: standard.id,
      title: standard.title,
      aliases: standard.aliases,
      composer: standard.composer,
      year: standard.year,
      key: standard.key,
    },
    update: {
      title: standard.title,
      aliases: standard.aliases,
      composer: standard.composer,
      year: standard.year,
      key: standard.key,
    },
  });

  // 2. Trouver le Work SHS correspondant
  const work = await findShsWork(standard, apiKey);
  if (!work) {
    console.log(`  ✗ Aucun Work SHS trouvé pour "${standard.title}"`);
    return stats;
  }

  const shsWorkId = extractShsId(work.uri);
  console.log(`  ✓ Work SHS #${shsWorkId} → "${work.title}"`);

  await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));

  // 3. Récupérer les performances avec leurs liens YouTube
  // TODO: ajuster l'endpoint selon la doc réelle SHS API v1
  const versionsResp = await shsGet(
    `/work/${shsWorkId}/versions?hasExternalLinks=true`,
    apiKey,
    ShsVersionsResponseSchema
  );

  const performances = versionsResp?.result ?? [];
  console.log(`    ${performances.length} performance(s) trouvée(s)`);

  for (const perf of performances) {
    const shsId = extractShsId(perf.uri);
    const youtubeUrl = extractYouTubeUrl(perf.external ?? []);

    if (!youtubeUrl) {
      stats.noYoutube++;
      continue;
    }

    const artist =
      perf.performer.commonName ?? perf.performer.name ?? "Artiste inconnu";
    const album = perf.releasedOn?.title ?? null;
    const year = parseYear(perf.releasedOn?.year ?? perf.date);

    const existing = await db.version.findUnique({ where: { youtubeUrl } });

    await db.version.upsert({
      where: { youtubeUrl },
      create: {
        standardId: standard.id,
        shsId,
        artist,
        album,
        year,
        youtubeUrl,
        youtubeStatus: "UNCHECKED",
      },
      update: {
        standardId: standard.id,
        shsId,
        artist,
        album,
        year,
      },
    });

    if (existing) {
      stats.updated++;
    } else {
      stats.created++;
      console.log(`    + ${artist} (${year ?? "?"})`);
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apiKey = process.env.SHS_API_KEY;
  if (!apiKey) {
    console.error(
      "SHS_API_KEY manquant dans .env.local\n" +
        "En attente de la clé API SecondHandSongs."
    );
    process.exit(1);
  }

  // Filtre optionnel : pnpm run seed:shs -- --standard autumn-leaves
  const flagIndex = process.argv.indexOf("--standard");
  const filterById = flagIndex !== -1 ? process.argv[flagIndex + 1] : null;

  const standards = filterById
    ? standardsData.filter((s) => s.id === filterById)
    : standardsData;

  if (filterById && standards.length === 0) {
    console.error(`Standard introuvable dans data/standards.json : "${filterById}"`);
    process.exit(1);
  }

  console.log(
    `\n🎷 Seed SHS — ${standards.length} standard(s) à traiter\n`
  );

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalNoYoutube = 0;

  for (const standard of standards) {
    console.log(`\n[${standard.id}]`);
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));

    const stats = await seedStandard(standard, apiKey);
    totalCreated += stats.created;
    totalUpdated += stats.updated;
    totalNoYoutube += stats.noYoutube;
  }

  console.log(
    `\n✓ Terminé — Créés : ${totalCreated} | Mis à jour : ${totalUpdated} | Sans YouTube : ${totalNoYoutube}`
  );
  console.log(
    "\nProchaines étapes :\n  pnpm run check\n  pnpm run fetch:lastfm\n  pnpm run apply:overrides"
  );

  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
