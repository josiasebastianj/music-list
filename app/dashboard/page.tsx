import { redirect } from "next/navigation";
import Icon from "@/components/Icon";
import SectionLayout from "@/components/SectionLayout";
import ThemeToggle from "@/components/ThemeToggle";
import { formatEventDate, migrationHint } from "@/lib/event";
import { createClient } from "@/lib/supabase/server";
import { DeleteEventButton, LogoutButton, NewEventButton, ShareEventButton } from "./DashboardButtons";

function songCount(data: unknown) {
  const songs = (data as { songs?: unknown } | null)?.songs;
  const n = Array.isArray(songs) ? songs.length : 0;
  return `${n} ${n === 1 ? "song" : "songs"}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: events, error } = await supabase
    .from("events")
    .select("id,event_name,event_date,owner,data,share_token,updated_at")
    .order("updated_at", { ascending: false });

  return (
    <SectionLayout current="events" actions={<><ThemeToggle /><LogoutButton /></>}>
      <main className="dash">
        <div className="dash-head">
          <div>
            <div className="eyebrow">EVENTS</div>
            <h1 className="dash-title">Your events</h1>
            <div className="dash-sub">{user.email}</div>
          </div>
          <NewEventButton />
        </div>
        {error && <div className="share-banner error" role="alert">Could not load events: {migrationHint(error.message)}</div>}
        {events && events.length > 0 ? (
          <ul className="dash-list">
            {events.map((e) => {
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
        ) : (
          !error && (
            <div className="workspace-empty dash-empty">
              <div className="workspace-empty-inner">
                <div className="workspace-empty-title">No events yet.</div>
                <div className="workspace-empty-copy">Use <strong>New event</strong> to build your first setlist.</div>
              </div>
            </div>
          )
        )}
      </main>
    </SectionLayout>
  );
}
