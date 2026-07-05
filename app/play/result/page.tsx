import Link from "next/link";
import { redirect } from "next/navigation";
import { getVersionById } from "@/lib/queries";

interface SearchParams {
  version: string;
  correct: string;
  answer: string;
  index: string;
  score: string;
  session: string;
  results: string;
}

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const version = await getVersionById(params.version);
  if (!version) redirect("/");

  const isCorrect = params.correct === "true";
  const currentScore = parseInt(params.score ?? "0", 10);
  const newScore = isCorrect ? currentScore + 1 : currentScore;
  const currentIndex = parseInt(params.index ?? "0", 10);
  const sessionIds = params.session?.split(",") ?? [];
  const nextIndex = currentIndex + 1;
  const isLastTrack = nextIndex >= sessionIds.length;

  const nextUrl = isLastTrack
    ? `/play/end?${new URLSearchParams({ score: String(newScore), total: String(sessionIds.length), session: params.session, results: params.results ?? "" })}`
    : `/play?${new URLSearchParams({
        session: params.session,
        index: String(nextIndex),
        score: String(newScore),
        results: params.results ?? "",
      })}`;

  const { standard } = version;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-6 max-w-md mx-auto w-full">
      <div className="text-center">
        <div className={`text-5xl mb-3 ${isCorrect ? "text-green-500" : "text-red-500"}`}>
          {isCorrect ? "✓" : "✗"}
        </div>
        <p className="text-xl font-semibold">
          {isCorrect ? "Bonne réponse !" : `C'était : ${standard.title}`}
        </p>
      </div>

      <div className="w-full rounded-xl border p-5 space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
          Enregistrement
        </p>
        <p className="font-semibold">{version.artist}</p>
        {version.album && (
          <p className="text-sm text-muted-foreground">
            {version.album}
            {version.year ? `, ${version.year}` : ""}
          </p>
        )}
        {version.youtubeUrl && (
          <a
            href={version.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:underline text-muted-foreground"
          >
            Écouter sur YouTube ↗
          </a>
        )}
      </div>

      <div className="w-full rounded-xl border p-5 space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
          Standard
        </p>
        <p className="font-semibold">{standard.title}</p>
        <p className="text-sm text-muted-foreground">
          {standard.composer}, {standard.year}
        </p>
        <p className="text-sm text-muted-foreground">Tonalité : {standard.key}</p>
      </div>

      <Link
        href={nextUrl}
        className="bg-foreground text-background px-8 py-3 rounded-full font-semibold hover:opacity-80 transition-opacity"
        data-testid="next-button"
      >
        {isLastTrack ? "Voir les résultats" : "Morceau suivant →"}
      </Link>
    </main>
  );
}
