import { redirect } from "next/navigation";
import { getAllVersionsForGame, getVersionById, getCatalogue } from "@/lib/queries";
import { drawSession } from "@/lib/session";
import { GamePlayer } from "./_components/GamePlayer";

interface SearchParams {
  session?: string;
  index?: string;
  score?: string;
  results?: string;
}

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  if (!params.session) {
    const versions = await getAllVersionsForGame();
    if (versions.length === 0) redirect("/?error=no-versions");
    const session = drawSession(versions, 10);
    const sp = new URLSearchParams({
      session: session.map((v) => v.id).join(","),
      index: "0",
      score: "0",
    });
    redirect(`/play?${sp}`);
  }

  const sessionIds = params.session.split(",");
  const index = parseInt(params.index ?? "0", 10);
  const score = parseInt(params.score ?? "0", 10);
  const results = params.results ?? "";

  if (index >= sessionIds.length) {
    const sp = new URLSearchParams({
      score: String(score),
      total: String(sessionIds.length),
      session: params.session,
      results,
    });
    redirect(`/play/end?${sp}`);
  }

  const [version, catalogue] = await Promise.all([
    getVersionById(sessionIds[index]),
    getCatalogue(),
  ]);

  if (!version?.youtubeUrl) redirect("/?error=version-unavailable");

  return (
    <GamePlayer
      version={version}
      catalogue={catalogue}
      sessionVersionIds={sessionIds}
      currentIndex={index}
      currentScore={score}
      currentResults={results}
    />
  );
}
