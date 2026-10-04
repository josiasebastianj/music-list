import { APP_VERSION, formatEventDate, safeColor, type SetlistEvent, type Song } from "./event";

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const p of String(text || "").split(/\r?\n/)) {
    if (!p.trim()) { out.push(""); continue; }
    let line = "";
    for (const word of p.trim().split(/\s+/)) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width <= maxWidth) line = test;
      else if (line) { out.push(line); line = word; }
      else {
        let chunk = "";
        for (const ch of word) {
          const testChunk = chunk + ch;
          if (ctx.measureText(testChunk).width > maxWidth && chunk) { out.push(chunk); chunk = ch; }
          else chunk = testChunk;
        }
        line = chunk;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function exportSongImage(event: SetlistEvent, song: Song, dark: boolean) {
  const scale = 2, width = 1200, pad = 60, cw = width - pad * 2, gap = 14;
  const title = song.title.trim() || "Song Title", baseKey = song.baseKey.trim(), eventName = event.eventName.trim(), eventDate = formatEventDate(event.eventDate), sections = song.sections;
  const palette = dark
    ? { bg1: "#132131", bg2: "#07111b", text: "#f1f5f9", muted: "#9aa8b7", line: "#2b4055", surface: "#0d1823", keyLine: "#4d8dff" }
    : { bg1: "#fbfaf6", bg2: "#f2f0e9", text: "#17202b", muted: "#6b7480", line: "#d8d6cf", surface: "#fcfbf7", keyLine: "#7aaeff" };

  const m = document.createElement("canvas").getContext("2d")!;
  const keyW = 190, keyH = 112, keyGap = 28, titleW = cw - keyW - keyGap;
  m.font = "700 54px Georgia,serif";
  const titleLines = wrapLines(m, title, titleW).slice(0, 2), titleLineH = 62, headerTop = pad;
  const titleAscent = m.measureText("Hg").actualBoundingBoxAscent || 48;
  const titleTop = headerTop + titleAscent;
  const titleBottom = titleTop + (titleLines.length - 1) * titleLineH + (m.measureText("Hg").actualBoundingBoxDescent || 10);
  const metaText = [eventName, eventDate].filter(Boolean).join(" • "), metaTop = titleBottom + 4, metaLineH = 30;
  const subtitleTop = metaTop + (metaText ? metaLineH + 8 : 0);
  const headerBottom = Math.max(headerTop + keyH, subtitleTop + 24) + 28, songDetailsLabelY = headerBottom + 2, leftW = 240, rightW = cw - leftW - 34;

  const measure = (s: Song["sections"][number]) => {
    m.font = "700 22px Inter,Arial,sans-serif";
    const nameLines = wrapLines(m, s.name || "Untitled", leftW - 54).slice(0, 2);
    m.font = "500 20px Inter,Arial,sans-serif";
    const note = s.note.trim(), noteLines = note ? wrapLines(m, note, rightW - 34) : [];
    const nameHeight = 42 + (nameLines.length - 1) * 29, noteHeight = noteLines.length ? 42 + (noteLines.length - 1) * 30 : 42;
    return { nameLines, noteLines, h: Math.max(72, Math.max(nameHeight, noteHeight) + 24) };
  };

  let total = songDetailsLabelY + 34;
  sections.forEach((s) => { total += measure(s).h + gap; });
  total += 70 + pad;

  const c = document.createElement("canvas");
  c.width = width * scale;
  c.height = Math.max(600, total) * scale;
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  const H = c.height / scale;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, palette.bg1); bg.addColorStop(0.55, palette.bg2); bg.addColorStop(1, dark ? "#07111b" : "#eeeae1");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, H);

  ctx.fillStyle = palette.text; ctx.font = "700 54px Georgia,serif";
  titleLines.forEach((line, i) => ctx.fillText(line, pad, titleTop + i * titleLineH));
  if (metaText) { ctx.fillStyle = palette.muted; ctx.font = "700 22px Inter,Arial,sans-serif"; ctx.fillText(metaText, pad, metaTop + 21); }
  ctx.strokeStyle = palette.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, headerBottom); ctx.lineTo(pad + cw, headerBottom); ctx.stroke();

  const keyX = width - pad - keyW, keyY = headerTop, keyText = baseKey || "—";
  ctx.fillStyle = palette.surface; ctx.strokeStyle = baseKey ? palette.keyLine : palette.line; ctx.lineWidth = 1.5;
  roundRect(ctx, keyX, keyY, keyW, keyH, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = palette.muted; ctx.font = "800 12px Inter,Arial,sans-serif"; ctx.fillText("BASE KEY", keyX + 20, keyY + 25);
  ctx.fillStyle = palette.text; ctx.font = "900 52px Inter,Arial,sans-serif";
  ctx.fillText(keyText, keyX + keyW / 2 - ctx.measureText(keyText).width / 2, keyY + 82);

  let y = songDetailsLabelY + 30;
  ctx.fillStyle = palette.muted; ctx.font = "800 14px Inter,Arial,sans-serif"; ctx.fillText("SONG DETAILS", pad, y);
  y += 28;
  sections.forEach((s) => {
    const accent = safeColor(s.color), { nameLines, noteLines, h } = measure(s);
    ctx.fillStyle = palette.surface; ctx.strokeStyle = accent + "99"; ctx.lineWidth = 1;
    roundRect(ctx, pad, y, cw, h, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = accent; ctx.fillRect(pad, y, 7, h);
    ctx.beginPath(); ctx.arc(pad + 34, y + 36, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = palette.text; ctx.font = "700 22px Inter,Arial,sans-serif";
    nameLines.forEach((line, i) => ctx.fillText(line, pad + 52, y + 42 + i * 29));
    ctx.strokeStyle = palette.line; ctx.beginPath(); ctx.moveTo(pad + leftW, y + 18); ctx.lineTo(pad + leftW, y + h - 18); ctx.stroke();
    if (noteLines.length) {
      ctx.fillStyle = palette.text; ctx.font = "500 20px Inter,Arial,sans-serif";
      noteLines.forEach((line, i) => ctx.fillText(line, pad + leftW + 24, y + 42 + i * 30));
    }
    y += h + gap;
  });

  const footerY = y + 10;
  ctx.strokeStyle = palette.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, footerY); ctx.lineTo(pad + cw, footerY); ctx.stroke();
  ctx.fillStyle = palette.muted; ctx.font = "500 15px Inter,Arial,sans-serif";
  ctx.fillText("setlist.app", pad, footerY + 27);
  ctx.fillText("Author: josiasebastianj", pad + 120, footerY + 27);
  ctx.fillText("Version: " + APP_VERSION, pad + 360, footerY + 27);

  const link = document.createElement("a");
  const safeFilename = title.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "song-structure";
  link.download = safeFilename + ".png";
  link.href = c.toDataURL("image/png");
  link.click();
}
