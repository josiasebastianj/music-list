export const APP_VERSION = "3.3.0";

export const colors = ["#8fc5ff", "#93dfb2", "#ffd37d", "#8edbe8", "#f3a5c6", "#f5c58a", "#c5a5f5", "#b6a9f5", "#9cdda9"];

export type Section = { id: string; name: string; color: string; note: string };
export type Song = { id: string; title: string; baseKey: string; rhythm: string; bpm: number | null; content: string; librarySongId?: string; sections: Section[] };
export type Member = { name: string; role: string };
export type SetlistEvent = { eventName: string; eventDate: string; owner: string; songs: Song[]; members: Member[] };
export type EventRow = { event_name: string | null; event_date: string | null; owner?: string | null; data: unknown; members?: unknown };

type Loose = { [key: string]: unknown } | null | undefined;
const str = (value: unknown) => (typeof value === "string" ? value : "");
const list = (value: unknown): Loose[] => (Array.isArray(value) ? value : []);
const cleanBpm = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 20 && value <= 300 ? value : null);

export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function safeColor(value: unknown) {
  const color = str(value).trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#8fc5ff";
}

function normalizeSections(sections: unknown): Section[] {
  return list(sections).map((s, i) => ({
    id: str(s?.id) || uid("section"),
    name: str(s?.name).trim(),
    color: safeColor(s?.color || colors[i % colors.length]),
    note: str(s?.note),
  }));
}

function normalizeSong(song: Loose): Song {
  const librarySongId = str(song?.librarySongId);
  return {
    id: str(song?.id) || uid("song"),
    title: str(song?.title),
    baseKey: str(song?.baseKey),
    rhythm: str(song?.rhythm).slice(0, 12),
    bpm: cleanBpm(song?.bpm),
    content: str(song?.content),
    ...(librarySongId ? { librarySongId } : {}),
    sections: normalizeSections(song?.sections),
  };
}

export function eventFromRow(row: EventRow): SetlistEvent {
  const data = row.data as Loose;
  return {
    eventName: row.event_name ?? "",
    eventDate: row.event_date ?? "",
    owner: row.owner ?? "",
    songs: list(data?.songs).map(normalizeSong),
    members: list(row.members).map((m) => ({ name: str(m?.name), role: str(m?.role) })),
  };
}

export function formatEventDate(date: string) {
  if (!date) return "";
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });
}

// "2026-10-04" → "2026-10"; "" when there's no usable date.
export const monthKey = (date: string | null) => (date && /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "");

export function formatMonth(key: string) {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

type ListedEvent = { event_date: string | null; owner: string | null };

export function ownerOptions(events: ListedEvent[]) {
  return [...new Set(events.map((e) => (e.owner ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

// Owner and month ("" = any), then by event date; undated events always last.
export function filterEvents<T extends ListedEvent>(events: T[], { owner, month, ascending }: { owner: string; month: string; ascending: boolean }): T[] {
  return events
    .filter((e) => (!owner || (e.owner ?? "").trim() === owner) && (!month || monthKey(e.event_date) === month))
    .sort((a, b) => {
      const x = a.event_date ?? "";
      const y = b.event_date ?? "";
      if (!x || !y) return x ? -1 : y ? 1 : 0;
      return ascending ? x.localeCompare(y) : y.localeCompare(x);
    });
}

export function randomShareToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

// Errors caused by migration 005 not having been run get a pointer to the fix.
export function migrationHint(message: string): string {
  if (!/(does not exist|schema cache|could not find)/i.test(message)) return message;
  if (/songs\.updated_at/i.test(message)) return `${message} — run supabase/migrations/006_song_updated_at.sql in the Supabase SQL Editor.`;
  return /(owner|rhythm|bpm|themes|song_themes)/i.test(message)
    ? `${message} — run supabase/migrations/005_library_details.sql in the Supabase SQL Editor.`
    : message;
}
