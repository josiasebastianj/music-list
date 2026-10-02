import { test } from "node:test";
import assert from "node:assert/strict";
import { colors, eventFromRow, randomShareToken, safeColor } from "./event.ts";

test("eventFromRow turns a malformed row into a valid event", () => {
  const event = eventFromRow({
    event_name: null,
    event_date: null,
    data: {
      songs: [
        { title: 5, baseKey: "G", sections: [{ name: "  Verse ", color: "red;background:url(x)" }, "junk"] },
        null,
      ],
    },
  });
  assert.equal(event.eventName, "");
  assert.equal(event.eventDate, "");
  assert.equal(event.songs.length, 2);
  const [song, empty] = event.songs;
  assert.equal(song.title, "");
  assert.equal(song.baseKey, "G");
  assert.ok(song.id.startsWith("song-"));
  assert.equal(song.sections[0].name, "Verse");
  assert.equal(song.sections[0].color, "#8fc5ff");
  assert.equal(song.sections[0].note, "");
  assert.equal(song.sections[1].color, colors[1]);
  assert.ok(song.sections[1].id.startsWith("section-"));
  assert.deepEqual(empty.sections, []);
});

test("eventFromRow handles missing or non-array data", () => {
  assert.deepEqual(eventFromRow({ event_name: "Sunday", event_date: "2026-10-04", data: null }), {
    eventName: "Sunday",
    eventDate: "2026-10-04",
    songs: [],
  });
  assert.deepEqual(eventFromRow({ event_name: null, event_date: null, data: { songs: "nope" } }).songs, []);
});

test("eventFromRow keeps valid data unchanged", () => {
  const songs = [{ id: "song-1", title: "Way Maker", baseKey: "E", sections: [{ id: "section-1", name: "Intro", color: "#93dfb2", note: "Soft\nkeys" }] }];
  assert.deepEqual(eventFromRow({ event_name: "A", event_date: "2026-10-04", data: { songs } }).songs, songs);
});

test("safeColor only accepts #rrggbb", () => {
  assert.equal(safeColor("#ABCdef"), "#ABCdef");
  assert.equal(safeColor("#fff"), "#8fc5ff");
  assert.equal(safeColor(undefined), "#8fc5ff");
});

test("randomShareToken is URL-safe and unique", () => {
  const a = randomShareToken();
  assert.match(a, /^[A-Za-z0-9_-]{24}$/);
  assert.notEqual(a, randomShareToken());
});
