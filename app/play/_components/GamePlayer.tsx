"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchStandards, type CatalogueEntry } from "@/lib/autocomplete";
import { extractYouTubeId } from "@/lib/youtube";

interface YTPlayer {
  playVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        el: string | HTMLElement,
        opts: {
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onError?: (e: { data: number }) => void;
          };
        }
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface Version {
  id: string;
  youtubeUrl: string;
  standardId: string;
  artist: string;
  album: string | null;
  year: number | null;
}

interface Props {
  version: Version;
  catalogue: CatalogueEntry[];
  sessionVersionIds: string[];
  currentIndex: number;
  currentScore: number;
  currentResults: string;
}

export function GamePlayer({
  version,
  catalogue,
  sessionVersionIds,
  currentIndex,
  currentScore,
  currentResults,
}: Props) {
  const router = useRouter();
  const playerRef = useRef<YTPlayer | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CatalogueEntry[]>([]);
  const [answered, setAnswered] = useState(false);

  const videoId = extractYouTubeId(version.youtubeUrl);

  useEffect(() => {
    if (!videoId) {
      setShowInput(true);
      return;
    }

    function startTimer(player: YTPlayer) {
      setTimeout(() => setShowInput(true), 3000);
      stopTimerRef.current = setTimeout(() => player.stopVideo(), 30000);
    }

    function initPlayer() {
      const player = new window.YT.Player("yt-player", {
        videoId: videoId ?? undefined,
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0 },
        events: {
          onReady: (e) => {
            playerRef.current = e.target;
            e.target.playVideo();
            startTimer(e.target);
          },
          onError: () => setShowInput(true),
        },
      });
      playerRef.current = player;
    }

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }

    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      playerRef.current?.destroy();
    };
  }, [videoId]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSuggestions(searchStandards(value, catalogue));
  }

  function submitAnswer(standardId: string | null) {
    if (answered) return;
    setAnswered(true);
    playerRef.current?.stopVideo();
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);

    const isCorrect = standardId === version.standardId;
    const newResults = currentResults
      ? `${currentResults},${isCorrect ? "1" : "0"}`
      : isCorrect ? "1" : "0";
    const params = new URLSearchParams({
      version: version.id,
      correct: String(isCorrect),
      answer: standardId ?? "",
      index: String(currentIndex),
      score: String(currentScore),
      session: sessionVersionIds.join(","),
      results: newResults,
    });
    router.push(`/play/result?${params}`);
  }

  function replayTrack() {
    playerRef.current?.seekTo(0, true);
    playerRef.current?.playVideo();
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(
      () => playerRef.current?.stopVideo(),
      30000
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-8">
      <p className="text-sm text-muted-foreground">
        Extrait {currentIndex + 1} / {sessionVersionIds.length}
      </p>

      <div className="hidden" aria-hidden="true">
        <div id="yt-player" />
      </div>

      <button
        onClick={replayTrack}
        className="px-5 py-2 rounded-full border hover:bg-accent transition-colors text-sm"
        data-testid="replay-button"
      >
        ↺ Réécouter
      </button>

      {!showInput && (
        <p className="text-muted-foreground animate-pulse">Écoutez…</p>
      )}

      {showInput && !answered && (
        <div className="w-full max-w-sm flex flex-col gap-3">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Quel standard ? (3 caractères min.)"
              autoFocus
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-foreground"
              data-testid="answer-input"
            />
            {suggestions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-10 overflow-hidden">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => submitAnswer(s.id)}
                      className="w-full px-4 py-3 text-left hover:bg-accent transition-colors text-sm"
                      data-testid={`suggestion-${s.id}`}
                    >
                      {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => submitAnswer(null)}
            className="text-muted-foreground text-sm hover:text-foreground transition-colors text-center"
            data-testid="skip-button"
          >
            Je ne sais pas →
          </button>
        </div>
      )}
    </main>
  );
}
