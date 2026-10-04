"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ponytail: testing mode — every tester signs in to one shared Supabase user. Restore the
// email/Google LoginForm from git history and re-enable sign-ups when real accounts are needed.
export async function logIn(_previous: string | null, formData: FormData): Promise<string | null> {
  const email = process.env.SHARED_LOGIN_EMAIL;
  if (!email) return "Login isn't set up: SHARED_LOGIN_EMAIL is missing.";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: String(formData.get("password") ?? "") });
  if (error) return error.code === "invalid_credentials" ? "Wrong password." : error.message;
  redirect("/dashboard");
}
