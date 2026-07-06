import { z } from "zod";
import standardsRaw from "../data/standards.json";

const StandardSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id doit être en kebab-case"),
  title: z.string().min(1),
  aliases: z.array(z.string()),
  composer: z.string().min(1),
  year: z.number().int().min(1900).max(2030),
  key: z.string().min(1),
});

const standards = standardsRaw as unknown[];
const errors: string[] = [];
const valid: z.infer<typeof StandardSchema>[] = [];

for (let i = 0; i < standards.length; i++) {
  const result = StandardSchema.safeParse(standards[i]);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`[${i}] ${issue.path.join(".")}: ${issue.message}`);
    }
  } else {
    valid.push(result.data);
  }
}

const seenIds = new Set<string>();
const seenTitles = new Set<string>();

for (const s of valid) {
  if (seenIds.has(s.id)) {
    errors.push(`id dupliqué : "${s.id}"`);
  }
  seenIds.add(s.id);

  const titleNorm = s.title.toLowerCase().trim();
  if (seenTitles.has(titleNorm)) {
    errors.push(`titre dupliqué (insensible à la casse) : "${s.title}"`);
  }
  seenTitles.add(titleNorm);
}

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length} erreur(s) dans data/standards.json :\n`);
  for (const e of errors) {
    console.error(`  • ${e}`);
  }
  process.exit(1);
} else {
  console.log(`✓ data/standards.json valide — ${valid.length} standards, aucune erreur.`);
}
