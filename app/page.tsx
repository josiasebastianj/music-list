import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: { searchParams: Promise<{ share?: string }> }) {
  const { share } = await searchParams;
  if (share) redirect(`/share/${encodeURIComponent(share)}`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/login");
}
