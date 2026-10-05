import { notFound, redirect } from "next/navigation";
import { LogoutButton } from "@/app/dashboard/DashboardButtons";
import SectionLayout from "@/components/SectionLayout";
import ThemeToggle from "@/components/ThemeToggle";
import { migrationHint } from "@/lib/event";
import { byName, type LibrarySong, type Theme } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";
import LibrarySongView from "./LibrarySongView";

export default async function LibrarySongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [songRes, themesRes] = await Promise.all([
    supabase.from("songs").select("id,title,artist,song_key,rhythm,bpm,content,search_text,themes(id,name)").eq("id", id).maybeSingle(),
    supabase.from("themes").select("id,name"),
  ]);
  // 22P02 = the id isn't a valid uuid: treat it like any unknown song
  if (songRes.error && songRes.error.code !== "22P02") throw new Error(`Could not load song: ${migrationHint(songRes.error.message)}`);
  if (!songRes.data) notFound();
  if (themesRes.error) throw new Error(`Could not load themes: ${migrationHint(themesRes.error.message)}`);

  const raw = songRes.data as LibrarySong;
  const song: LibrarySong = { ...raw, themes: [...(raw.themes ?? [])].sort(byName) };
  const themes = ((themesRes.data ?? []) as Theme[]).sort(byName);

  return (
    <SectionLayout current="library" actions={<><ThemeToggle /><LogoutButton /></>}>
      <main className="dash">
        <LibrarySongView initial={song} themes={themes} />
      </main>
    </SectionLayout>
  );
}
