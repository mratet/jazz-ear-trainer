import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),
  SHS_API_KEY: z.string().default(""),
  LASTFM_API_KEY: z.string().default(""),
  NEXT_PUBLIC_E2E: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Variables d'environnement manquantes : ${missing}`);
}

export const env = parsed.data;
