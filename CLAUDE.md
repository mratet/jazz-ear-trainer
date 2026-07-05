# Guidelines — Jazz Ear Trainer

Ce fichier définit les conventions de code et la stratégie de test du projet.
Il est lu automatiquement par Claude Code lors de l'implémentation.

---

## Stack

- **Next.js App Router** + TypeScript strict
- **Prisma** + Neon (PostgreSQL)
- **Tailwind CSS** + shadcn/ui
- **Vitest** (tests unitaires et intégration)
- **Playwright** (tests end-to-end)
- **pnpm** (gestionnaire de paquets)

---

## Conventions TypeScript

- Mode strict activé (`"strict": true` dans `tsconfig.json`)
- Pas de `any` — utiliser `unknown` si le type est réellement inconnu
- Types explicites sur les fonctions publiques
- Utiliser `satisfies` pour les constantes typées (configs Fuse.js, mappings d'enums)
- Path alias `@/` configuré dans `tsconfig.json` — pas d'imports relatifs `../../`

**Zod vs types Prisma :**
- **Prisma génère les types pour les données en base** — ne pas les redéfinir
- **Zod valide les données externes** (réponses API SHS/Last.fm, formulaires, variables d'environnement)
- Règle : `Prisma.StandardGetPayload<...>` pour typer les résultats de requêtes, Zod uniquement aux frontières

**Exports :**
- Pages Next.js : `export default` (requis par le framework)
- Tout le reste (`lib/`, `components/`) : **named exports** uniquement

**Variables d'environnement :** validées au démarrage dans `lib/env.ts` via Zod.
Si une variable est absente, l'app doit crasher explicitement au démarrage, pas silencieusement.

---

## Architecture Next.js App Router

### Server vs Client Components

- **Server Components par défaut** — passer en Client Component (`"use client"`) uniquement si nécessaire
  (état local, événements browser, IFrame YouTube)
- Les appels Prisma se font **uniquement côté serveur** (via `lib/queries.ts`)
- `"use client"` est **contagieux vers le bas** : tout ce qu'importe un Client Component devient
  client-side. Pour passer un Server Component dans un Client Component, utiliser le pattern `children` :
  ```tsx
  // ✅ correct
  <ClientWrapper>{/* Server Component ici */}</ClientWrapper>
  // ❌ incorrect
  // importer un Server Component directement dans un Client Component
  ```
- **Props non-sérialisables interdites** entre Server → Client : pas de fonctions, pas d'instances de classe,
  pas de `Date` non converties. Les dates Prisma (`updatedAt`) doivent être converties en string ou timestamp avant d'être passées à un Client Component.

### Server Actions vs Route Handlers

- **Server Actions** (`"use server"`) : mutations internes à l'app (ex: `markVersionUnavailable` après un `onError` YouTube)
- **Route Handlers** (`app/api/*/route.ts`) : APIs externes entrantes ou appels APIs tierces (SHS, Last.fm)
- Ne pas créer de Route Handler pour des mutations qui n'ont pas besoin d'être exposées en HTTP

### Format des erreurs de Route Handler

```typescript
// Toujours ce format
return NextResponse.json({ error: "Message lisible", code: "STANDARD_NOT_FOUND" }, { status: 404 })
```

### Gestion des erreurs Next.js

- `app/error.tsx` — erreurs inattendues dans les Server Components (boundaries d'erreur)
- `app/not-found.tsx` — ressource introuvable
- Erreurs attendues avec comportement UX précis (vidéo YouTube indisponible, standard sans version) :
  gérées directement dans le composant, sans remonter vers `error.tsx`
- Logging : `console.error` suffit pour un POC — pas de dépendance de logging externe

---

## Structure des fichiers

```
app/                          ← pages, layouts, Route Handlers
  [route]/
    _components/              ← composants propres à cette route (colocation)
    page.tsx
    error.tsx
    loading.tsx
components/
  ui/                         ← shadcn/ui — ne jamais modifier
  shared/                     ← composants réutilisables hors shadcn (Spinner, Badge custom...)
lib/
  db.ts                       ← singleton PrismaClient (voir ci-dessous)
  queries.ts                  ← toutes les requêtes Prisma (couche d'accès aux données)
  autocomplete.ts             ← logique Fuse.js + normalisation
  session.ts                  ← logique de session (tirage, scoring)
  youtube.ts                  ← helpers IFrame API + gestion onError
  env.ts                      ← validation des variables d'environnement (Zod)
  errors.ts                   ← types d'erreurs attendues (YouTubeUnavailableError...)
scripts/                      ← scripts de seeding (Node.js, pas Next.js)
prisma/
  schema.prisma
data/
  standards.json
  manual-overrides.json
e2e/                          ← tests Playwright
```

**Nommage des fichiers :**
- `kebab-case.ts` pour les modules (`lib/`, `scripts/`)
- `PascalCase.tsx` pour les composants React
- Pas de fichiers `index.ts` de re-export — importer directement le fichier source

### Singleton PrismaClient (obligatoire)

```typescript
// lib/db.ts — toujours importer `db` depuis ce fichier, jamais instancier PrismaClient ailleurs
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const db = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
```

Sans ce singleton, le hot reload Next.js crée de nouvelles connexions à chaque rechargement
et épuise le pool de connexions Neon.

### Couche de requêtes (lib/queries.ts)

Toutes les requêtes Prisma passent par `lib/queries.ts`. Les Server Components et Server Actions
n'appellent jamais `db.*` directement — ils appellent des fonctions de `queries.ts` :

```typescript
// lib/queries.ts
export async function getAvailableVersions(standardId: string) { ... }
export async function markVersionUnavailable(versionId: string) { ... }
export async function getStandardsByIds(ids: string[]) { ... }
```

---

## Stratégie de test

### Principe général

Tester la logique, pas le framework. On ne teste pas shadcn/ui, Prisma lui-même, ou l'IFrame YouTube.

### Vitest — tests unitaires

**Périmètre :**

| Module | Ce qui est testé |
|---|---|
| `lib/autocomplete.ts` | Normalisation, Fuse.js, seuil 3 chars, aliases, casse, diacritiques |
| `lib/session.ts` | Tirage sans remise, liste < 10 standards, scoring, cas limites |
| `lib/youtube.ts` | Extraction ID depuis URL, gestion des codes d'erreur |
| `scripts/validate.ts` | Doublons, formats invalides, JSON malformé |
| Route Handlers | Réponses API — tester la **logique extraite**, pas le handler directement |

**Conventions :**
- Fichiers `*.test.ts` colocalisés avec le fichier testé
- Un `describe` par fonction ou module
- Nommer les tests en français
- `vi.mock` pour les dépendances modules (Prisma, fs, modules Node)
- `msw` pour intercepter les appels HTTP sortants (SHS API, Last.fm API)
  — ne pas mélanger les deux approches

**Exemples :**

```typescript
// lib/autocomplete.test.ts
describe("normalizeTitle", () => {
  it("supprime l'article 'The' en début de titre", () =>
    expect(normalizeTitle("The Days of Wine and Roses")).toBe("days of wine and roses"))
  it("supprime l'article 'A' en début de titre", () =>
    expect(normalizeTitle("A Night in Tunisia")).toBe("night in tunisia"))
  it("gère les apostrophes jazz", () =>
    expect(normalizeTitle("'Round Midnight")).toBe("round midnight"))
  it("ne supprime pas un article en milieu de titre", () =>
    expect(normalizeTitle("All The Things You Are")).toBe("all the things you are"))
})

describe("searchStandards", () => {
  it("ne retourne aucune suggestion en dessous de 3 caractères", () =>
    expect(searchStandards("Au", catalogue)).toHaveLength(0))
  it("retourne des suggestions pour exactement 3 caractères", () =>
    expect(searchStandards("Aut", catalogue).length).toBeGreaterThan(0))
  it("retourne au maximum 5 suggestions", () =>
    expect(searchStandards("All", catalogue).length).toBeLessThanOrEqual(5))
  it("trouve sans tenir compte de la casse", () =>
    expect(searchStandards("AUTUMN", catalogue)[0].title).toBe("Autumn Leaves"))
  it("trouve via un alias bilingue", () =>
    expect(searchStandards("feuilles mortes", catalogue)[0].title).toBe("Autumn Leaves"))
  it("retourne un tableau vide pour un catalogue vide", () =>
    expect(searchStandards("Autumn", [])).toHaveLength(0))
})

describe("drawSession", () => {
  it("ne tire jamais deux fois le même enregistrement", () => {
    const session = drawSession(catalogue, 10)
    const ids = session.map(v => v.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it("retourne tous les enregistrements si le catalogue < 10", () => {
    const small = catalogue.slice(0, 6)
    expect(drawSession(small, 10)).toHaveLength(6)
  })
})
```

**Coverage :** seuil minimum de 80% sur `lib/`. Configuré dans `vitest.config.ts` :
```typescript
coverage: { provider: "v8", thresholds: { lines: 80 }, include: ["lib/**"] }
```

### Playwright — tests E2E

**Périmètre :**

| Scénario | Description |
|---|---|
| Session complète | Lancer, répondre à 10 extraits, voir l'écran de fin avec score |
| Bonne réponse | Sélectionner le bon titre → feedback ✓ |
| Mauvaise réponse | Sélectionner un mauvais titre → feedback ✗ + bon titre |
| Passer | Cliquer "Je ne sais pas" → compté comme raté, fiche affichée |
| Autocomplete | 3 chars → suggestions visibles ; 2 chars → aucune suggestion |
| Erreur vidéo YouTube | Voir ci-dessous |
| Liste personnalisée | Sélection persistée après rechargement (localStorage) |

**Simulation de l'erreur vidéo YouTube :**
L'iframe YouTube est cross-origin — Playwright ne peut pas injecter d'événements dedans.
Approche retenue : variable d'environnement de test.
En mode `NEXT_PUBLIC_E2E=true`, le composant `YoutubePlayer` rend un bouton
"Simuler erreur vidéo" qui déclenche le même code que `onError`. Playwright clique dessus.

```typescript
// e2e/error-handling.spec.ts
test("charge une autre version si la vidéo est indisponible", async ({ page }) => {
  await page.getByTestId("simulate-video-error").click()
  await expect(page.getByTestId("audio-player")).toBeVisible() // nouvelle version chargée
})
```

**Isolation des données :**
- Phase 1-2 : les tests E2E tournent contre des **fixtures JSON statiques** (pas de DB)
- Phase 3+ : base Neon dédiée aux tests (branching Neon), reset avant chaque run via
  `playwright/global-setup.ts` + `pnpm prisma db push --force-reset`
- `data-testid` sur tous les éléments interactifs — ajoutés lors de l'implémentation

**Convention :** fichiers `e2e/*.spec.ts`, un fichier par feature.

### Ce qu'on ne teste pas

- Composants shadcn/ui
- L'IFrame YouTube directement (testé via abstraction, voir ci-dessus)
- Prisma lui-même
- Scripts de seeding end-to-end (tester uniquement les fonctions de parsing isolément)

---

## CI — GitHub Actions

Workflow à créer dans `.github/workflows/ci.yml` dès le début du projet :

```yaml
- pnpm tsc --noEmit          # typecheck
- pnpm lint                  # ESLint
- pnpm test --run            # Vitest (sans watch)
- pnpm playwright test       # E2E (sur environnement de test)
```

Les PRs ne sont mergées qu'après passage du CI.

---

## Commits

Suivre les **Conventional Commits** :
```
feat: ajouter l'autocomplete sur le champ de saisie
fix: corriger le tirage sans remise sur petite liste
chore: mettre à jour les dépendances
test: ajouter les tests de normalisation des titres
```
