import AppShell from "@/components/AppShell";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <AppShell actions={<ThemeToggle />}>
      <main className="dash">Migration in progress.</main>
    </AppShell>
  );
}
