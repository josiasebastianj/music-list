import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/dashboard/DashboardButtons";
import Icon from "@/components/Icon";
import SectionLayout from "@/components/SectionLayout";
import ThemeToggle from "@/components/ThemeToggle";
import { migrationHint } from "@/lib/event";
import { byName, byTitle, type LibrarySong, type Theme } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";
import LibraryList from "./LibraryList";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [songsRes, themesRes] = await Promise.all([
    supabase.from("songs").select("id,title,artist,song_key,rhythm,bpm,search_text,themes(id,name)"),
    supabase.from("themes").select("id,name"),
  ]);
  const error = songsRes.error ?? themesRes.error;
  const songs = ((songsRes.data ?? []) as Omit<LibrarySong, "content">[])
    .map((s) => ({ ...s, themes: [...(s.themes ?? [])].sort(byName) }))
    .sort(byTitle);
  const themes = ((themesRes.data ?? []) as Theme[]).sort(byName);

  return (
    <SectionLayout current="library" actions={<><ThemeToggle /><LogoutButton /></>}>
      <main className="dash">
        <div className="dash-head">
          <div>
            <div className="eyebrow">LIBRARY</div>
            <h1 className="dash-title">Songs</h1>
            <div className="dash-sub">{songs.length} {songs.length === 1 ? "song" : "songs"}, A–Z. Add a song once and use it in every event.</div>
          </div>
          <Link className="btn primary" href="/library/new">
            <Icon name="plus" />
            Add songs
          </Link>
        </div>
        {error ? (
          <div className="share-banner error" role="alert">Could not load the library: {migrationHint(error.message)}</div>
        ) : (
          <LibraryList songs={songs} themes={themes} />
        )}
      </main>
    </SectionLayout>
  );
}
