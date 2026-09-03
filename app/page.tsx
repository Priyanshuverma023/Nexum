export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Nexum</h1>
      <a
        href="/api/connect"
        className="rounded-lg bg-black px-6 py-3 text-white"
      >
        Connect Google Account
      </a>
    </main>
  );
}