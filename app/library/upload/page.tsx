import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ThemeToggle from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/server";
import UploadSongs from "./UploadSongs";

export default async function UploadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppShell
      actions={
        <>
          <Link className="btn" href="/dashboard" aria-label="Dashboard">
            ←<span className="btn-label"> Dashboard</span>
          </Link>
          <ThemeToggle />
        </>
      }
    >
      <main className="dash">
        <div className="dash-head">
          <div>
            <div className="eyebrow">LIBRARY</div>
            <h1 className="dash-title">Upload songs</h1>
            <div className="dash-sub">ChordPro (.cho, .chopro, .pro, .chordpro) or plain text with chords above the lyrics (.txt).</div>
          </div>
        </div>
        <UploadSongs />
      </main>
    </AppShell>
  );
}
