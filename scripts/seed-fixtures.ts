/**
 * Seed de développement — 5 standards avec enregistrements YouTube
 * Usage : pnpm seed
 *
 * AVANT DE LANCER : remplacez les YOUTUBE_ID_x par de vrais IDs YouTube.
 * Recherchez chaque enregistrement sur youtube.com et copiez l'ID de l'URL
 * (partie après "?v="). Ex : youtube.com/watch?v=dQw4w9WgXcQ → ID = dQw4w9WgXcQ
 *
 * 1. Miles Davis & Cannonball Adderley – Autumn Leaves (Somethin' Else, 1958)
 * 2. Thelonious Monk – 'Round Midnight (Brilliant Corners, 1957)
 * 3. Dave Brubeck Quartet – Take Five (Time Out, 1959)
 * 4. Bill Evans Trio – Stella By Starlight (Waltz for Debby, 1961)
 * 5. John Coltrane – My Favorite Things (My Favorite Things, 1961)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const FIXTURES = [
  {
    standard: {
      id: "autumn-leaves",
      title: "Autumn Leaves",
      aliases: ["Les Feuilles Mortes", "feuilles mortes", "les feuilles mortes"],
      composer: "Joseph Kosma",
      year: 1945,
      key: "G minor",
    },
    versions: [
      {
        artist: "Miles Davis & Cannonball Adderley",
        album: "Somethin' Else",
        year: 1958,
        youtubeUrl: "https://www.youtube.com/watch?v=CpB7-8SGlJ0",
        format: "QUARTET" as const,
        style: "HARD_BOP" as const,
        era: "ERA_1950S" as const,
        lastFmTags: ["jazz", "hard bop", "miles davis"],
      },
    ],
  },
  {
    standard: {
      id: "round-midnight",
      title: "'Round Midnight",
      aliases: ["Round Midnight", "round midnight", "round about midnight"],
      composer: "Thelonious Monk",
      year: 1944,
      key: "Eb minor",
    },
    versions: [
      {
        artist: "Thelonious Monk",
        album: "Brilliant Corners",
        year: 1957,
        youtubeUrl: "https://www.youtube.com/watch?v=IrAfjW5qiyo",
        format: "QUARTET" as const,
        style: "BEBOP" as const,
        era: "ERA_1950S" as const,
        lastFmTags: ["jazz", "bebop", "thelonious monk"],
      },
    ],
  },
  {
    standard: {
      id: "take-five",
      title: "Take Five",
      aliases: ["take 5"],
      composer: "Paul Desmond",
      year: 1959,
      key: "Eb minor",
    },
    versions: [
      {
        artist: "Dave Brubeck Quartet",
        album: "Time Out",
        year: 1959,
        youtubeUrl: "https://www.youtube.com/watch?v=ryA6eHZNnXY",
        format: "QUARTET" as const,
        style: "COOL_JAZZ" as const,
        era: "ERA_1950S" as const,
        lastFmTags: ["jazz", "cool jazz", "dave brubeck", "5/4"],
      },
    ],
  },
  {
    standard: {
      id: "stella-by-starlight",
      title: "Stella By Starlight",
      aliases: ["stella by starlight", "stella"],
      composer: "Victor Young",
      year: 1944,
      key: "Bb major",
    },
    versions: [
      {
        artist: "Bill Evans Trio",
        album: "Waltz for Debby",
        year: 1961,
        youtubeUrl: "https://www.youtube.com/watch?v=tARB9hEm3i4",
        format: "TRIO" as const,
        style: "COOL_JAZZ" as const,
        era: "ERA_1960S" as const,
        lastFmTags: ["jazz", "piano trio", "bill evans"],
      },
    ],
  },
  {
    standard: {
      id: "my-favorite-things",
      title: "My Favorite Things",
      aliases: ["my favourite things"],
      composer: "Richard Rodgers",
      year: 1959,
      key: "E minor",
    },
    versions: [
      {
        artist: "John Coltrane",
        album: "My Favorite Things",
        year: 1961,
        youtubeUrl: "https://www.youtube.com/watch?v=JQvc-Gkwhow",
        format: "QUARTET" as const,
        style: "MODAL" as const,
        era: "ERA_1960S" as const,
        lastFmTags: ["jazz", "modal jazz", "john coltrane", "soprano saxophone"],
      },
    ],
  },
];

async function main() {
  console.log("🌱 Suppression des données existantes...");
  await db.version.deleteMany();
  await db.standard.deleteMany();

  console.log("🌱 Insertion des standards et versions...");

  for (const { standard, versions } of FIXTURES) {
    await db.standard.create({ data: standard });

    for (const version of versions) {
      await db.version.create({
        data: { ...version, standardId: standard.id, lastFmTags: version.lastFmTags },
      });
    }

    console.log(`  ✓ ${standard.title}`);
  }

  console.log(`\n✅ Seed terminé : ${FIXTURES.length} standards insérés.`);
  console.log("⚠️  Pensez à remplacer les YOUTUBE_ID_x par de vrais IDs YouTube.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
