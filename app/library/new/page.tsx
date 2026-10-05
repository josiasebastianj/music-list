import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/dashboard/DashboardButtons";
import SectionLayout from "@/components/SectionLayout";
import ThemeToggle from "@/components/ThemeToggle";
import { migrationHint } from "@/lib/event";
import { byName, type Theme } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";
import AddSongs from "./AddSongs";

export default async function NewSongsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.from("themes").select("id,name");

  return (
    <SectionLayout current="library" actions={<><ThemeToggle /><LogoutButton /></>}>
      <main className="dash">
        <div className="dash-head">
          <div>
            <div className="eyebrow"><Link href="/library">LIBRARY</Link></div>
            <h1 className="dash-title">Add songs</h1>
            <div className="dash-sub">Paste a chord sheet or upload ChordPro / text files. Check the preview, then save to the library.</div>
          </div>
        </div>
        {error && <div className="share-banner error" role="alert">Could not load themes: {migrationHint(error.message)}</div>}
        <AddSongs themes={((data ?? []) as Theme[]).sort(byName)} />
      </main>
    </SectionLayout>
  );
}
