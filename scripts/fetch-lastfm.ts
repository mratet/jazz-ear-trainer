import { z } from "zod";
import { db, closeDb } from "./_db";
import type { Style, Era } from "@prisma/client";

const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";
const RATE_LIMIT_MS = 250;

const TagSchema = z.object({
  name: z.string(),
  count: z.number().or(z.string().transform(Number)),
});

const TopTagsResponseSchema = z.object({
  toptags: z
    .object({ tag: z.array(TagSchema) })
    .optional(),
  error: z.number().optional(),
  message: z.string().optional(),
});

const TAG_TO_STYLE: Record<string, Style> = {
  bebop: "BEBOP",
  bop: "BEBOP",
  "hard bop": "HARD_BOP",
  hardbop: "HARD_BOP",
  "post-bop": "HARD_BOP",
  "cool jazz": "COOL_JAZZ",
  "cool": "COOL_JAZZ",
  "west coast jazz": "COOL_JAZZ",
  "modal jazz": "MODAL",
  modal: "MODAL",
  "bossa nova": "BOSSA_NOVA",
  bossanova: "BOSSA_NOVA",
  "latin jazz": "LATIN",
  latin: "LATIN",
  "afro-cuban": "LATIN",
  ballad: "BALLAD",
  swing: "SWING",
  "big band": "SWING",
  "free jazz": "FREE_JAZZ",
  "avant-garde": "FREE_JAZZ",
  "avant garde": "FREE_JAZZ",
  fusion: "FUSION",
  "jazz fusion": "FUSION",
  "contemporary jazz": "CONTEMPORARY",
  "smooth jazz": "CONTEMPORARY",
} satisfies Record<string, Style>;

function yearToEra(year: number): Era {
  if (year < 1930) return "ERA_1920S";
  if (year < 1940) return "ERA_1930S";
  if (year < 1950) return "ERA_1940S";
  if (year < 1960) return "ERA_1950S";
  if (year < 1970) return "ERA_1960S";
  if (year < 1980) return "ERA_1970S";
  if (year < 1990) return "ERA_1980S";
  if (year < 2000) return "ERA_1990S";
  if (year < 2010) return "ERA_2000S";
  if (year < 2020) return "ERA_2010S";
  return "ERA_2020S";
}

function simplifyArtist(artist: string): string {
  return artist
    .split(/\s+[&,]\s+/)[0]
    .replace(/\s+(Quartet|Trio|Quintet|Sextet|Septet|Orchestra|Big Band|Group|Ensemble|Band|All[ -]?Stars?)$/i, "")
    .replace(/^The\s+/i, "")
    .trim();
}

function inferStyle(tags: string[]): Style | null {
  for (const tag of tags) {
    const style = TAG_TO_STYLE[tag.toLowerCase()];
    if (style) return style;
  }
  return null;
}

async function apiGet(params: Record<string, string>, apiKey: string): Promise<unknown> {
  const url = new URL(LASTFM_BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  const res = await fetch(url.toString());
  return res.json();
}

async function fetchTrackTags(artist: string, track: string, apiKey: string): Promise<string[]> {
  const json = await apiGet({ method: "track.gettoptags", artist, track }, apiKey);
  const parsed = TopTagsResponseSchema.safeParse(json);
  if (!parsed.success || parsed.data.error) return [];
  return (parsed.data.toptags?.tag ?? []).filter((t) => t.count > 0).map((t) => t.name.toLowerCase());
}

async function fetchArtistTags(artist: string, apiKey: string): Promise<string[]> {
  const ArtistTagsSchema = z.object({
    toptags: z.object({ tag: z.array(TagSchema) }).optional(),
    error: z.number().optional(),
  });
  const json = await apiGet({ method: "artist.gettoptags", artist }, apiKey);
  const parsed = ArtistTagsSchema.safeParse(json);
  if (!parsed.success || parsed.data.error) return [];
  return (parsed.data.toptags?.tag ?? []).filter((t) => t.count > 0).map((t) => t.name.toLowerCase());
}

async function main() {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    console.error("LASTFM_API_KEY manquant dans .env.local");
    process.exit(1);
  }

  const versions = await db.version.findMany({
    include: { standard: true },
    orderBy: { updatedAt: "asc" },
  });

  console.log(`Enrichissement Last.fm de ${versions.length} enregistrement(s)…\n`);

  let updated = 0;
  let skipped = 0;

  for (const v of versions) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));

    const title = v.titleOverride ?? v.standard.title;
    const simplified = simplifyArtist(v.artist);

    // Essai 1 : artiste complet + titre (track-level)
    let tags = await fetchTrackTags(v.artist, title, apiKey);

    // Essai 2 : artiste simplifié + titre (supprime "Trio", "&...", etc.)
    if (tags.length === 0 && simplified !== v.artist) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
      tags = await fetchTrackTags(simplified, title, apiKey);
    }

    // Essai 3 : tags de l'artiste (artist-level — plus fiable pour le jazz)
    if (tags.length === 0) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
      tags = await fetchArtistTags(simplified, apiKey);
    }

    if (tags.length === 0) {
      console.log(`  ✗ ${v.artist} — ${title} (introuvable)`);
      skipped++;
      continue;
    }

    const inferredStyle = inferStyle(tags);
    const recordingYear = v.year ?? v.standard.year;
    const inferredEra = yearToEra(recordingYear);

    await db.version.update({
      where: { id: v.id },
      data: {
        lastFmTags: tags,
        style: v.style ?? inferredStyle ?? undefined,
        era: v.era ?? inferredEra,
      },
    });

    console.log(`  ✓ ${v.artist} — ${v.standard.title} [${tags.slice(0, 3).join(", ")}]`);
    updated++;
  }

  console.log(`\nMis à jour : ${updated} | Ignorés : ${skipped}`);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
