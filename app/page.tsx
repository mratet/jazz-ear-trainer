import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Jazz Ear Trainer</h1>
        <p className="text-muted-foreground max-w-sm">
          Entraînez votre oreille sur des standards de jazz. Écoutez un extrait et retrouvez le titre.
        </p>
      </div>
      <Link
        href="/play"
        className="bg-foreground text-background px-8 py-4 rounded-full text-lg font-semibold hover:opacity-80 transition-opacity"
      >
        Lancer une session
      </Link>
    </main>
  );
}
