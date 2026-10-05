import { notFound } from "next/navigation";
import EventEditor from "@/components/EventEditor";
import { eventFromRow } from "@/lib/event";
import { createClient } from "@/lib/supabase/server";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("id,event_name,event_date,data,members,share_token").eq("id", id).maybeSingle();
  // 22P02 = the id isn't a valid uuid: treat it like any unknown event
  if (error && error.code !== "22P02") throw new Error(`Could not load event: ${error.message}`);
  if (!data) notFound();
  return <EventEditor initial={eventFromRow(data)} eventId={data.id} shareToken={data.share_token} />;
}
