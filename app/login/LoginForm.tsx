"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import AppShell from "@/components/AppShell";
import ThemeToggle from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";

type Message = { text: string; error: boolean } | null;

export default function LoginForm({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(initialError ? { text: initialError, error: true } : null);
  const callback = () => `${location.origin}/auth/callback`;

  function done() {
    router.push("/dashboard");
    router.refresh();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ text: error.message, error: true });
        setBusy(false);
        return;
      }
      return done();
    }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback() } });
    setBusy(false);
    if (error) return setMessage({ text: error.message, error: true });
    if (data.session) return done();
    setMessage({ text: "Check your email to confirm your account, then log in.", error: false });
  }

  async function google() {
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    if (error) setMessage({ text: error.message, error: true });
  }

  return (
    <AppShell actions={<ThemeToggle />}>
      <main className="auth-card">
        <h1 className="auth-title">{mode === "signin" ? "Log in" : "Create account"}</h1>
        {message && <p className={`auth-message${message.error ? " error" : ""}`} role="status">{message.text}</p>}
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Log in" : "Sign up"}
          </button>
        </form>
        <div className="auth-divider">or</div>
        <button className="btn" type="button" onClick={google}>Continue with Google</button>
        <button
          className="auth-switch"
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMessage(null);
          }}
        >
          {mode === "signin" ? "No account? Sign up" : "Have an account? Log in"}
        </button>
      </main>
    </AppShell>
  );
}
