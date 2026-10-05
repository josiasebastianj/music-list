import { redirect } from "next/navigation";
import SectionLayout from "@/components/SectionLayout";
import ThemeToggle from "@/components/ThemeToggle";
import { migrationHint } from "@/lib/event";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton, NewEventButton } from "./DashboardButtons";
import EventList from "./EventList";

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
          <EventList events={events} />
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
