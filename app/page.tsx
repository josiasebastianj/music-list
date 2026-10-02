import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ThemeToggle from "@/components/ThemeToggle";

export default async function Home({ searchParams }: { searchParams: Promise<{ share?: string }> }) {
  const { share } = await searchParams;
  if (share) redirect(`/share/${encodeURIComponent(share)}`);
  return (
    <AppShell actions={<ThemeToggle />}>
      <main className="dash">Open an event at /events/&lt;id&gt;.</main>
    </AppShell>
  );
}
