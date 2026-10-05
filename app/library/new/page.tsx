import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/dashboard/DashboardButtons";
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

  return <AddSongs themes={((data ?? []) as Theme[]).sort(byName)} actions={<><ThemeToggle /><LogoutButton /></>} loadError={error ? migrationHint(error.message) : undefined} />;
}
