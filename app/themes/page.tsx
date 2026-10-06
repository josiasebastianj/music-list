import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/dashboard/DashboardButtons";
import SectionLayout from "@/components/SectionLayout";
import ThemeToggle from "@/components/ThemeToggle";
import { migrationHint } from "@/lib/event";
import { byName } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";
import ThemeManager from "./ThemeManager";

export default async function ThemesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.from("themes").select("id,name,song_themes(count)");
  const themes = (data ?? [])
    .map((t: { id: string; name: string; song_themes: { count: number }[] | null }) => ({ id: t.id, name: t.name, songs: t.song_themes?.[0]?.count ?? 0 }))
    .sort(byName);

  return (
    <SectionLayout current="themes" actions={<><ThemeToggle /><LogoutButton /></>}>
      <main className="dash">
        <div className="dash-head">
          <div>
            <div className="eyebrow">THEME</div>
            <h1 className="dash-title">Themes</h1>
            <div className="dash-sub">Tag library songs by theme, like Easter, Communion or Praise.</div>
          </div>
        </div>
        {error ? (
          <div className="share-banner error" role="alert">Could not load themes: {migrationHint(error.message)}</div>
        ) : (
          <ThemeManager initial={themes} />
        )}
      </main>
    </SectionLayout>
  );
}
