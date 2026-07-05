import Link from "next/link";
import { getVersionsWithStandardByIds } from "@/lib/queries";

interface SearchParams {
  score: string;
  total: string;
  session: string;
  results: string;
}

export default async function EndPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const score = parseInt(params.score ?? "0", 10);
  const total = parseInt(params.total ?? "0", 10);
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  const sessionIds = params.session?.split(",") ?? [];
  const resultFlags = params.results?.split(",") ?? [];

  const versions = await getVersionsWithStandardByIds(sessionIds);
  const versionMap = new Map(versions.map((v) => [v.id, v]));

  const tracks = sessionIds.map((id, i) => ({
    version: versionMap.get(id),
    correct: resultFlags[i] === "1",
  }));

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-1">Fin de session</h1>
        <p className="text-6xl font-bold my-6">{score}/{total}</p>
        <p className="text-muted-foreground">{pct}% de réussite</p>
      </div>

      {tracks.length > 0 && (
        <div className="w-full max-w-md space-y-2">
          {tracks.map(({ version, correct }, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border px-4 py-3"
            >
              <span className={correct ? "text-green-500" : "text-red-500"}>
                {correct ? "✓" : "✗"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {version?.standard.title ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {version?.artist}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <Link
          href="/play"
          className="bg-foreground text-background px-6 py-3 rounded-full font-semibold hover:opacity-80 transition-opacity"
        >
          Nouvelle session
        </Link>
        <Link
          href="/"
          className="px-6 py-3 rounded-full border font-semibold hover:bg-accent transition-colors"
        >
          Accueil
        </Link>
      </div>
    </main>
  );
}
