import Fuse from "fuse.js";

export interface CatalogueEntry {
  id: string;
  title: string;
  aliases: string[];
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[''`']/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(the|a|an|les|la|le|l|un|une)\s+/, "")
    .trim();
}

export function searchStandards(query: string, catalogue: CatalogueEntry[]): CatalogueEntry[] {
  if (query.length < 3) return [];

  const items = catalogue.map((entry) => ({
    entry,
    _title: normalizeTitle(entry.title),
    _aliases: entry.aliases.map(normalizeTitle),
  }));

  const fuse = new Fuse(items, {
    keys: [
      { name: "_title", weight: 2 },
      { name: "_aliases", weight: 1 },
    ],
    threshold: 0.4,
    includeScore: true,
  });

  return fuse
    .search(normalizeTitle(query))
    .slice(0, 5)
    .map((r) => r.item.entry);
}
