"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { randomShareToken } from "@/lib/event";
import { createClient } from "@/lib/supabase/client";

export function NewEventButton() {
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const id = crypto.randomUUID();
    const { error } = await createClient().from("events").insert({ id, data: { songs: [] }, share_token: randomShareToken() });
    if (error) {
      setBusy(false);
      alert(`Could not create event: ${error.message}`);
      return;
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full page load so beforeunload guards unsaved edits on Back
    window.location.assign(`/events/${id}`);
  }

  return (
    <button className="btn primary" type="button" onClick={create} disabled={busy}>
      {busy ? "Creating…" : <><Icon name="plus" />New event</>}
    </button>
  );
}

export function ShareEventButton({ token, name }: { token: string; name: string }) {
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function share() {
    const url = `${location.origin}/share/${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast(true);
    } catch {
      prompt("Copy this read-only link:", url);
    }
  }

  return (
    <>
      <button className="icon-btn" type="button" title="Copy share link" aria-label={`Copy share link for ${name}`} onClick={share}>
        <Icon name="share" />
      </button>
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">{toast && "Share link copied to clipboard"}</div>
    </>
  );
}

export function DeleteEventButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();

  async function remove() {
    if (!confirm(`Delete "${name}"? Its share link will stop working.`)) return;
    const { error } = await createClient().from("events").delete().eq("id", id);
    if (error) {
      alert(`Could not delete event: ${error.message}`);
      return;
    }
    router.refresh();
  }

  return (
    <button className="icon-btn danger" type="button" title="Delete event" aria-label={`Delete ${name}`} onClick={remove}>
      <Icon name="trash" />
    </button>
  );
}

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut({ scope: "local" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button className="btn" type="button" onClick={logout}>
      Log out
    </button>
  );
}
