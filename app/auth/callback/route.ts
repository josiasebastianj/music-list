import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/dashboard`);
  }
  const message = searchParams.get("error_description") ?? "Sign-in link expired or was opened in another browser. If you just confirmed your email, log in below.";
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
}
