# Jazz Ear Trainer — Plan de projet

## Vision

POC open-source pour s'entraîner à reconnaître des standards de jazz à l'oreille.
L'utilisateur écoute un extrait audio réel, tape le titre, et reçoit un retour immédiat
accompagné d'informations sur le morceau.

**Principes fondamentaux :**
- Pas de compte utilisateur — aucune identification requise
- Pas de système de progression
- Jamais payant
- Open-source

---

## Flux principal

```
1. L'utilisateur choisit ou configure une liste de standards à travailler
2. L'app sélectionne une version aléatoire parmi les versions disponibles du standard
3. Lecture d'un extrait 30s (YouTube IFrame API, audio uniquement, sans titre visible)
4. L'utilisateur tape le titre (validation par correspondance floue) ou passe
5. Feedback : correct / incorrect + fiche de l'enregistrement et du standard
```

---

## Fonctionnalités — Version 1

### Session de jeu
- Une session = 10 extraits tirés depuis la liste active
- Tirage sans remise par enregistrement : un même enregistrement n'apparaît pas deux fois
  dans une session. Un même standard peut apparaître en versions différentes.
- Cas limite : si la liste personnalisée contient moins de 10 standards disponibles,
  la session se termine au nombre de standards disponibles.
- Pour chaque extrait :
  - L'extrait démarre automatiquement
  - Le champ de saisie apparaît après quelques secondes (pas un concours de vitesse)
  - Réécouter autant de fois que souhaité
  - Taper le titre librement (correspondance floue via Fuse.js : "autum leaves" → accepté)
  - Ou passer via un bouton "Je ne sais pas" (compté comme une réponse ratée)
- Écran résultat après chaque extrait :
  - ✓ correct ou ✗ + le bon titre si faux
  - **Fiche de l'enregistrement** : artiste, album, année, format, style, BPM
  - **Fiche du standard** : compositeur, année de composition, tonalité originale
    (la tonalité n'est affichée que si l'enregistrement est transposé)
  - Bouton "Réécouter l'extrait"
  - Lien vers l'enregistrement complet sur YouTube
  - Bouton "Morceau suivant"
- Fin de session (après le 10e extrait) :
  - Score récapitulatif (ex. 7/10)
  - Liste des standards ratés ou passés
  - Options : "Rejouer la même liste" / "Nouvelle session"

### Listes de standards
**Prédéfinies :**
- "Grands classiques" — liste courte des incontournables absolus (à construire au lancement)
- "Real Book complet" — édition large (~200 standards)
- Par artiste ou par style — hors scope v1, prévu pour plus tard

**Personnalisée :**
- Sous-ensemble des standards disponibles en base
- Sélection dans l'interface, persistée en **localStorage** (pas de compte requis)
- Bouton "Copier le lien" → URL encodée partageable (`?list=autumn-leaves,stella,...`)
- Protocole d'ajout d'un standard manquant :
  - Proposition via `data/standards.json` (PR sur le repo)
  - Validation automatique par `pnpm run validate` (orthographe, doublons, existence SHS)
  - Merge par le mainteneur → seed déclenché

### Onboarding
- Message d'accueil sur la page principale expliquant le principe en quelques lignes
- Placeholder dans le champ de saisie indiquant ce qui est attendu

### Hors scope v1
- Comptes utilisateurs
- Système de niveaux ou progression
- Listes par artiste ou par style
- Identification de tonalité, tempo, grille d'accords par l'utilisateur
- Application mobile native
- Détection de transposition automatique (exploration future)
- Ciblage automatique du thème ou d'un solo dans l'extrait (exploration future)

### Idées pour versions futures
- **Format "standard du jour"** — un standard tiré quotidiennement pour tous les utilisateurs,
  résultat partageable (inspiré de Heardle/Wordle). Crée un rendez-vous et facilite le partage.
- Listes par artiste ou par style
- Révélation progressive de l'extrait (quelques secondes → quelques secondes supplémentaires si raté)

---

## Sources de données

| Source | Rôle |
|---|---|
| **`data/standards.json`** | Source de vérité versionnée dans le repo (titres, compositeurs, aliases) |
| **SecondHandSongs API** | Découverte des versions + liens YouTube par performance (auth requise) |
| **YouTube IFrame API** | Lecture audio côté client (iframe cachée, player custom, 30s via timer) |
| **Last.fm API** | Tags de style (swing, bossa, bebop...) — indicatif uniquement |
| **`data/manual-overrides.json`** | Corrections manuelles versionnées, jamais écrasées par le seed |
| **Base de données (Neon)** | Catalogue hébergé, reconstruisable via scripts de seeding |

---

## Architecture des données

Les données dérivées de SHS/Last.fm vivent dans Neon (PostgreSQL), jamais dans le repo.
Seuls deux fichiers de données sont versionnés :
- `data/standards.json` — liste des standards (source de vérité)
- `data/manual-overrides.json` — corrections manuelles appliquées en dernière passe du seed

```
pnpm run seed       ← reconstruit la base depuis zéro
pnpm run check      ← vérifie les statuts YouTube et met à jour la base
pnpm run validate   ← valide standards.json avant merge d'une contribution
```

### Schéma Prisma

```prisma
model Standard {
  id          String    @id           // ex: "autumn-leaves"
  title       String
  aliases     String[]                // titres alternatifs acceptés à la saisie
  composer    String
  year        Int
  key         String                  // tonalité originale (ex: "G minor")
  versions    Version[]
  updatedAt   DateTime  @updatedAt
}

model Version {
  id              String        @id @default(cuid())
  standardId      String
  standard        Standard      @relation(fields: [standardId], references: [id])
  artist          String
  album           String?
  year            Int?
  shsId           String?
  youtubeUrl      String?       @unique  // URL complète ex: "https://www.youtube.com/watch?v=..."
  youtubeStatus   YoutubeStatus @default(UNCHECKED)
  format          Format?
  style           Style?
  era             Era?
  key             String?               // null = même tonalité que Standard
  titleOverride   String?               // titre commercial si différent du standard
  themeTimecode   Int?                  // secondes — null jusqu'à analyse audio future
  lastFmTags      String[]
  updatedAt       DateTime  @updatedAt

  @@unique([standardId, shsId])
  @@index([standardId])
  @@index([youtubeStatus])
}

enum Format {
  VOCAL
  VOCAL_TRIO
  SOLO_PIANO
  TRIO
  QUARTET
  QUINTET
  BIG_BAND
  OTHER
}

enum Style {
  BEBOP
  COOL_JAZZ
  HARD_BOP
  MODAL
  BOSSA_NOVA
  LATIN
  BALLAD
  SWING
  FREE_JAZZ
  FUSION
  CONTEMPORARY
  OTHER
}

enum Era {
  ERA_1920S
  ERA_1930S
  ERA_1940S
  ERA_1950S
  ERA_1960S
  ERA_1970S
  ERA_1980S
  ERA_1990S
  ERA_2000S
  ERA_2010S
  ERA_2020S
  UNKNOWN
}

enum YoutubeStatus {
  AVAILABLE       // vidéo accessible
  UNAVAILABLE     // vidéo supprimée, privée ou âge-restreinte
  GEO_RESTRICTED  // bloquée dans certaines régions
  NOT_FOUND       // SHS n'avait pas de lien YouTube pour cette performance
  UNCHECKED       // non encore vérifié
}
```

**`youtubeUrl`** : URL complète stockée telle que fournie par SHS. L'ID vidéo est extrait
côté client pour initialiser le YouTube IFrame API. Aucune serverless function nécessaire —
la lecture est entièrement gérée côté client.

**Lecture audio** : iframe YouTube rendue hors écran, contrôlée via YouTube IFrame API.
Un timer JavaScript arrête la lecture après 30s. L'utilisateur ne voit ni titre, ni miniature,
ni interface YouTube — uniquement le player custom de l'app.

**`youtubeStatus`** : vérifié périodiquement par `check-youtube.ts` via l'endpoint oEmbed de YouTube
(`youtube.com/oembed?url=...`) — retourne 200 si disponible, 404 si supprimée. Aucune clé API
YouTube requise pour cette vérification.

**Erreur vidéo en cours de session** : le callback `onError` de l'IFrame API détecte
automatiquement les vidéos inaccessibles (codes 100, 101, 150 = supprimée, privée, embed interdit).
L'app tire silencieusement une autre version du même standard et relance la lecture — sans
interaction utilisateur, sans compter comme tentative. Si toutes les versions d'un standard
échouent, on passe au standard suivant avec un message discret.
Les erreurs détectées mettent à jour `youtubeStatus = UNAVAILABLE` en base en temps réel.

**Autoplay mobile** : l'IFrame API YouTube bloque l'autoplay sans interaction préalable.
Le clic sur "Lancer la session" constitue l'interaction requise — à valider en Phase 1.

**`manual-overrides.json`** est appliqué en dernière passe du seed (`apply-overrides.ts`).
Il préserve les données validées manuellement (`key`, `themeTimecode`) à travers les reconstructions.

**`key` dans Version** : null = même tonalité que Standard. Renseigné manuellement pour
les versions transposées (cas vocal principalement). Affiché dans la fiche résultat uniquement
si différent de `Standard.key`.

**`titleOverride`** : titre commercial de l'enregistrement quand il diffère du titre du standard.
Utilisé uniquement pour l'affichage dans la fiche résultat, pas pour la validation de réponse.

**`themeTimecode`** : réservé pour une future analyse audio ; v1 démarre à 0s.

**Intervention humaine dans le pipeline** : limitée à deux moments :
1. Après le seed : vérifier les versions `UNCHECKED` et corriger les liens YouTube erronés
2. Ponctuellement : renseigner `key` pour les versions transposées, alimenter `aliases` dans `standards.json`

---

## Pipeline de seeding : SHS → YouTube

Pipeline simplifié — SHS fournit directement les liens YouTube, pas de mapping externe nécessaire.

```
1. SOURCE DE VÉRITÉ
   data/standards.json (dans le repo)
   → titre, compositeur, année, tonalité, aliases

2. SHS : trouver le Work
   GET /search?title="{titre}"
   → garder le Work dont le compositeur correspond (match exact ou Fuse.js strict)
   → stocker le shsWorkId

3. SHS : récupérer les performances avec leurs liens YouTube
   GET /work/{shsWorkId}/performances  (auth SHS requise pour les liens externes)
   → liste de {artiste, année, titre, youtubeUrl}
   → ignorer les performances sans lien YouTube → youtubeStatus = NOT_FOUND

4. VÉRIFICATION
   Pour chaque youtubeUrl :
   GET youtube.com/oembed?url={youtubeUrl}&format=json
   → 200 : youtubeStatus = AVAILABLE
   → 404 : youtubeStatus = UNAVAILABLE
   (pas de clé API YouTube requise)

5. ENRICHISSEMENT Last.fm
   GET last.fm/track/{artiste}/{titre}/tags
   → alimenter lastFmTags, inférer style et era
```

Les corrections manuelles sont sauvegardées dans `manual-overrides.json`
pour survivre aux reconstructions.

---

## Saisie de la réponse — Autocomplete

L'utilisateur sélectionne le titre dans un **champ autocomplete** plutôt que de saisir du texte libre.
La validation devient binaire : le standard sélectionné correspond ou non au standard joué.

**Comportement :**
- Suggestions visibles uniquement à partir de **3 caractères** — évite de révéler la réponse sur les petits catalogues
- Maximum **5 suggestions** affichées simultanément
- Fuse.js utilisé sous le capot pour le matching flou dans la recherche (gestion des fautes de frappe)
- Normalisation avant la recherche : lowercase, suppression des accents, des articles initiaux

**Le champ `aliases[]`** alimente l'index de recherche Fuse.js : taper "feuilles mortes"
fait remonter "Autumn Leaves", taper "ornithology" fait remonter "How High the Moon".
Les aliases ne s'affichent pas dans la liste — seul le titre canonique apparaît en suggestion.

---

## Statistiques de disponibilité

Le script `check` scanne le catalogue et produit un rapport :

```
Autumn Leaves    : 12/15 versions disponibles
All The Things   :  8/15 versions disponibles
Summertime       :  3/15 versions disponibles
...
Total            : 487/750 versions (65%)
```

Les absences sont tracées avec le statut approprié (`NOT_FOUND`, `UNAVAILABLE`, `GEO_RESTRICTED`, `UNCHECKED`).

---

## Stack technique

```
Next.js + TypeScript + Tailwind CSS + shadcn/ui
Prisma (ORM) + Neon (PostgreSQL, free tier)
SecondHandSongs API + Last.fm API
YouTube IFrame API (lecture côté client, pas de clé requise)
Fuse.js (correspondance floue)
pnpm + ESLint/Prettier
Vercel (déploiement gratuit)
```

**Pas de serverless function audio** : la lecture YouTube est entièrement côté client via
l'IFrame API. Le SSR reste pertinent pour les requêtes Prisma (accès DB serveur).

---

## Structure du repo

```
jazz-ear-trainer/
├── app/                        ← pages et routes Next.js
├── components/                 ← composants UI
├── lib/                        ← logique métier (Deezer, matching...)
├── prisma/
│   └── schema.prisma           ← schéma de la base (versionné)
├── data/
│   ├── standards.json          ← source de vérité des standards (versionné)
│   └── manual-overrides.json   ← corrections manuelles (versionné)
├── scripts/
│   ├── seed-shs.ts             ← peuple la base depuis SecondHandSongs (liens YouTube inclus)
│   ├── check-youtube.ts        ← vérifie les statuts YouTube via oEmbed (sans clé API)
│   ├── fetch-lastfm.ts         ← récupère les tags de style
│   ├── apply-overrides.ts      ← applique manual-overrides.json en fin de seed
│   ├── validate.ts             ← valide standards.json avant merge
│   └── seed-fixtures.ts        ← seed minimal sans clés API (pour contributeurs)
├── .env.example                ← variables d'environnement requises
├── README.md                   ← description, demo, stack, how to run
├── CONTRIBUTING.md             ← workflow PR, comment ajouter un standard
└── PLAN.md
```

### Variables d'environnement (`.env.example`)

```
DATABASE_URL=          # Neon connection string (PostgreSQL)
SHS_API_KEY=           # SecondHandSongs (requis pour récupérer les liens YouTube)
LASTFM_API_KEY=        # Last.fm API
```

---

## Écrans principaux

1. **Accueil** — présentation, choix de liste, lancement d'une session
2. **Jeu** — lecteur audio, champ de saisie, bouton "Je ne sais pas"
3. **Résultat** — feedback + fiche enregistrement + fiche standard + actions
4. **Fin de session** — score, standards ratés, options de relance
5. **Admin / Catalogue** — statuts YouTube par version, standards sans lien (usage interne)

---

## Étapes de développement

| Phase | Contenu | Objectif |
|---|---|---|
| **0 — Setup** | Repo GitHub, Next.js, Prisma + Neon, `.env.example`, `README.md`, Vercel | Environnement prêt |
| **1 — Prototype** | `seed-fixtures.ts` + 5 standards, page de jeu fonctionnelle | Valider le concept |
| **2 — Pipeline données** | Scripts SHS→YouTube + Last.fm, `manual-overrides`, catalogue initial | Données réelles |
| **3 — Application** | Interface soignée, fin de session, listes personnalisées, localStorage | MVP utilisable |
| **4 — Polish** | Calibration Fuse.js, `CONTRIBUTING.md`, retours utilisateurs | Prêt à partager |
