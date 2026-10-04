"use client";

import { useActionState } from "react";
import AppShell from "@/components/AppShell";
import ThemeToggle from "@/components/ThemeToggle";
import { logIn } from "./actions";

export default function LoginForm({ initialError }: { initialError: string | null }) {
  const [error, formAction, pending] = useActionState(logIn, initialError);

  return (
    <AppShell actions={<ThemeToggle />}>
      <main className="auth-card">
        <h1 className="auth-title">Log in</h1>
        {error && <p className="auth-message error" role="alert">{error}</p>}
        <form className="auth-form" action={formAction}>
          <label>
            Password
            <input type="password" name="password" required autoComplete="current-password" autoFocus />
          </label>
          <button className="btn primary" type="submit" disabled={pending}>
            {pending ? "Please wait…" : "Log in"}
          </button>
        </form>
      </main>
    </AppShell>
  );
}
