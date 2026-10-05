"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { filterEvents, formatEventDate, formatMonth, monthKey, ownerOptions } from "@/lib/event";
import { DeleteEventButton, ShareEventButton } from "./DashboardButtons";

export type EventRowSummary = { id: string; event_name: string | null; event_date: string | null; owner: string | null; data: unknown; share_token: string | null };

function songCount(data: unknown) {
  const songs = (data as { songs?: unknown } | null)?.songs;
  const n = Array.isArray(songs) ? songs.length : 0;
  return `${n} ${n === 1 ? "song" : "songs"}`;
}

export default function EventList({ events }: { events: EventRowSummary[] }) {
  const [owner, setOwner] = useState("");
  const [month, setMonth] = useState("");
  const [ascending, setAscending] = useState(false);
  const owners = useMemo(() => ownerOptions(events), [events]);
  const months = useMemo(() => [...new Set(events.map((e) => monthKey(e.event_date)).filter(Boolean))].sort().reverse(), [events]);
  // A filter whose last event was deleted falls back to "All".
  const ownerSel = owners.includes(owner) ? owner : "";
  const monthSel = months.includes(month) ? month : "";
  const shown = useMemo(() => filterEvents(events, { owner: ownerSel, month: monthSel, ascending }), [events, ownerSel, monthSel, ascending]);

  return (
    <>
      <div className="lib-filters">
        <select className="team-input lib-theme-filter" value={ownerSel} onChange={(e) => setOwner(e.target.value)} aria-label="Filter by owner">
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <select className="team-input lib-theme-filter" value={monthSel} onChange={(e) => setMonth(e.target.value)} aria-label="Filter by month">
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
        <button className="btn" type="button" onClick={() => setAscending((a) => !a)} title="Sort by event date" aria-label={`Sorted by event date, ${ascending ? "oldest" : "newest"} first. Click to reverse.`}>
          Date {ascending ? "↑" : "↓"}
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="lyrics-empty">No events match.</p>
      ) : (
        <ul className="dash-list">
          {shown.map((e) => {
            const name = e.event_name || "Untitled Event";
            return (
              <li key={e.id} className="dash-item">
                <a href={`/events/${e.id}`} className="dash-link">
                  <span className="dash-name">{name}</span>
                  <span className="dash-meta">{[formatEventDate(e.event_date ?? ""), songCount(e.data), e.owner ? `Owner: ${e.owner}` : ""].filter(Boolean).join(" · ")}</span>
                </a>
                <a href={`/events/${e.id}`} className="icon-btn" title="Edit event" aria-label={`Edit ${name}`}>
                  <Icon name="edit" />
                </a>
                {e.share_token && <ShareEventButton token={e.share_token} name={name} />}
                <DeleteEventButton id={e.id} name={name} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
