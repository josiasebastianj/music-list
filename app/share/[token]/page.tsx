import { notFound } from "next/navigation";
import EventEditor from "@/components/EventEditor";
import { eventFromRow, type EventRow } from "@/lib/event";
import { createClient } from "@/lib/supabase/server";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_event", { token }).maybeSingle<EventRow>();
  if (error) throw new Error(`Could not load shared event: ${error.message}`);
  if (!data) notFound();
  return <EventEditor initial={eventFromRow(data)} readOnly />;
}
