import { notFound } from "next/navigation";
import EventEditor from "@/components/EventEditor";
import { eventFromRow } from "@/lib/event";
import { createClient } from "@/lib/supabase/server";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("id,event_name,event_date,data,share_token").eq("id", id).maybeSingle();
  if (!data) notFound();
  return <EventEditor initial={eventFromRow(data)} eventId={data.id} shareToken={data.share_token} />;
}
