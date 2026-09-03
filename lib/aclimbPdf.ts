import { jsPDF } from "jspdf";

export type PdfPlan = {
  name: string;
  revision: number;
  effectiveDate: string;
  reviewDate?: string;
  trailLocation: "woodland" | "mountain" | "lakeside";
  weekdays: number[];
  sessionTimes: string[];
  exercises: Array<{
    name: string;
    side: string;
    notes: string;
    reps: number;
    sets: number;
    holdSeconds?: number;
  }>;
};

export type PdfSession = {
  date: string;
  time: string;
  planRevision: number;
  status: "completed" | "partial" | "rest";
  restReason?: "clinician" | "pain" | "schedule" | "other";
  exercises: Array<{ sets: number[]; status: "active" | "completed" | "skipped" }>;
};

export type ACLimbPdfData = {
  profileName: string;
  plan: PdfPlan | null;
  planHistory: PdfPlan[];
  sessions: PdfSession[];
  keepsakes: Array<{ label: string; kind: "stamp" | "postcard"; earnedAt: string }>;
  wins: Array<{ label: string; value: string; unit: string; date: string; note: string }>;
};

const forest: [number, number, number] = [49, 92, 76];
const darkForest: [number, number, number] = [31, 61, 50];
const gold: [number, number, number] = [239, 186, 74];
const ink: [number, number, number] = [38, 50, 44];
const muted: [number, number, number] = [103, 117, 108];
const pale: [number, number, number] = [239, 245, 239];

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, "->")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");
}

function dateFromKey(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayDate(value: string | Date) {
  const date = typeof value === "string" ? dateFromKey(value) : value;
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function displayTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2020, 0, 1, hours, minutes));
}

function activePlan(data: ACLimbPdfData, generatedAt: Date) {
  const today = dateKey(generatedAt);
  const plans = [...data.planHistory, ...(data.plan ? [data.plan] : [])];
  return plans
    .filter((plan) => plan.effectiveDate <= today)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.revision - a.revision)[0]
    ?? data.plan;
}

export function buildACLimbPdf(data: ACLimbPdfData, generatedAt = new Date()) {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const plan = activePlan(data, generatedAt);
  let y = 0;

  doc.setProperties({
    title: "ACLimb activity summary",
    subject: "User-requested physiotherapy plan and activity summary",
    author: "ACLimb",
    creator: "ACLimb local PDF export",
  });

  function pageContinuationHeader() {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setFillColor(...forest);
    doc.rect(0, 0, pageWidth, 34, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("ACLimb  /  Activity summary", margin, 22);
    y = 57;
  }

  function ensureSpace(points: number) {
    if (y + points <= pageHeight - 58) return;
    doc.addPage();
    pageContinuationHeader();
  }

  function section(title: string) {
    ensureSpace(39);
    doc.setFillColor(...pale);
    doc.roundedRect(margin, y, contentWidth, 27, 5, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...forest);
    doc.text(safeText(title).toUpperCase(), margin + 11, y + 18);
    y += 39;
  }

  function paragraph(text: string, options?: { color?: [number, number, number]; font?: "normal" | "bold" | "italic"; indent?: number }) {
    const indent = options?.indent ?? 0;
    const lines = doc.splitTextToSize(safeText(text), contentWidth - indent);
    const height = Math.max(14, lines.length * 12);
    ensureSpace(height + 4);
    doc.setFont("helvetica", options?.font ?? "normal");
    doc.setFontSize(9);
    doc.setTextColor(...(options?.color ?? ink));
    doc.text(lines, margin + indent, y);
    y += height + 4;
  }

  function detailRow(label: string, value: string) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text(safeText(label), margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...ink);
    doc.text(safeText(value), margin + 105, y);
    y += 18;
  }

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(...darkForest);
  doc.rect(0, 0, pageWidth, 126, "F");
  doc.setFillColor(...gold);
  doc.circle(pageWidth - 68, 43, 18, "F");
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(2);
  doc.line(pageWidth - 78, 49, pageWidth - 69, 40);
  doc.line(pageWidth - 69, 40, pageWidth - 60, 45);
  doc.line(pageWidth - 60, 45, pageWidth - 52, 34);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(27);
  doc.setTextColor(255, 255, 255);
  doc.text("ACLimb", margin, 45);
  doc.setFontSize(16);
  doc.text("Activity summary", margin, 76);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(215, 230, 221);
  doc.text(`Prepared ${safeText(displayDate(generatedAt))}  |  Generated locally on this device`, margin, 98);
  doc.setFontSize(7.5);
  doc.text("Pain scores and private session notes are excluded.", margin, 114);
  y = 153;

  if (data.profileName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...ink);
    doc.text(`Journey summary for ${safeText(data.profileName)}`, margin, y);
    y += 25;
  }

  const completed = data.sessions.filter((session) => session.status === "completed");
  const partial = data.sessions.filter((session) => session.status === "partial");
  const rest = data.sessions.filter((session) => session.status === "rest");
  const actualSets = completed.reduce(
    (total, session) => total + session.exercises
      .filter((exercise) => exercise.status === "completed")
      .reduce((sum, exercise) => sum + exercise.sets.length, 0),
    0,
  );
  const actualReps = completed.reduce(
    (total, session) => total + session.exercises
      .filter((exercise) => exercise.status === "completed")
      .reduce((sum, exercise) => sum + exercise.sets.reduce((setTotal, reps) => setTotal + reps, 0), 0),
    0,
  );
  const stats = [
    ["COMPLETED", completed.length],
    ["ACTUAL REPS", actualReps],
    ["RECORDED SETS", actualSets],
    ["KEEPSAKES", data.keepsakes.length],
  ] as const;
  const gap = 9;
  const cardWidth = (contentWidth - gap * 3) / 4;
  stats.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + gap);
    doc.setFillColor(...pale);
    doc.roundedRect(x, y, cardWidth, 58, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...forest);
    doc.text(String(value), x + 10, y + 25);
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(label, x + 10, y + 43);
  });
  y += 79;

  section("Current plan");
  if (!plan) {
    paragraph("No plan has been saved yet.", { color: muted });
  } else {
    detailRow("Plan", `${plan.name}  /  Revision ${plan.revision}`);
    detailRow("Effective", displayDate(plan.effectiveDate));
    detailRow("Review", plan.reviewDate ? displayDate(plan.reviewDate) : "Not set");
    detailRow("Trail", `${plan.trailLocation[0].toUpperCase()}${plan.trailLocation.slice(1)}`);
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = [1, 2, 3, 4, 5, 6, 0].filter((day) => plan.weekdays.includes(day)).map((day) => weekdayNames[day]).join(", ");
    detailRow("Schedule", `${days} at ${plan.sessionTimes.map(displayTime).join(", ")}`);

    section("Prescribed exercises");
    plan.exercises.forEach((exercise, index) => {
      ensureSpace(exercise.notes ? 50 : 35);
      doc.setFillColor(248, 248, 244);
      doc.roundedRect(margin, y - 11, contentWidth, exercise.notes ? 46 : 31, 4, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...ink);
      doc.text(`${index + 1}. ${safeText(exercise.name)}`, margin + 10, y + 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      const hold = exercise.holdSeconds ? `  |  Hold ${exercise.holdSeconds} sec` : "";
      doc.text(`${exercise.sets} sets x ${exercise.reps} reps  |  ${safeText(exercise.side)}${hold}`, margin + 10, y + 16);
      if (exercise.notes) {
        const note = doc.splitTextToSize(`Clinician note: ${safeText(exercise.notes)}`, contentWidth - 20)[0];
        doc.setFont("helvetica", "italic");
        doc.text(note, margin + 10, y + 30);
      }
      y += exercise.notes ? 55 : 40;
    });
  }

  section("Session history");
  paragraph(`${completed.length} completed  |  ${partial.length} partial  |  ${rest.length} recorded rest`, { color: muted });
  const recentSessions = [...data.sessions].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).slice(0, 30);
  if (!recentSessions.length) {
    paragraph("No sessions have been recorded yet.", { color: muted });
  } else {
    recentSessions.forEach((session) => {
      const reps = session.exercises.reduce((total, exercise) => total + exercise.sets.reduce((sum, count) => sum + count, 0), 0);
      const status = session.status === "rest" && session.restReason ? `Rest - ${session.restReason}` : `${session.status[0].toUpperCase()}${session.status.slice(1)}`;
      const result = session.status === "completed" ? `${reps} actual reps` : status;
      detailRow(`${displayDate(session.date)}  ${displayTime(session.time)}`, `${result}  /  Revision ${session.planRevision}`);
    });
    if (data.sessions.length > recentSessions.length) paragraph(`Showing the 30 most recent of ${data.sessions.length} saved sessions.`, { color: muted, font: "italic" });
  }

  section("Personal wins");
  if (!data.wins.length) {
    paragraph("No personal wins have been saved yet.", { color: muted });
  } else {
    [...data.wins].sort((a, b) => b.date.localeCompare(a.date)).forEach((win) => {
      const measurement = win.value ? ` - ${win.value}${win.unit ? ` ${win.unit}` : ""}` : "";
      paragraph(`${displayDate(win.date)}  |  ${win.label}${measurement}`, { font: "bold" });
      if (win.note) paragraph(win.note, { color: muted, font: "italic", indent: 12 });
    });
  }

  section("Journey keepsakes");
  if (!data.keepsakes.length) {
    paragraph("No keepsakes have been earned yet.", { color: muted });
  } else {
    [...data.keepsakes].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt)).forEach((keepsake) => {
      paragraph(`${displayDate(keepsake.earnedAt)}  |  ${keepsake.label} (${keepsake.kind})`);
    });
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(221, 226, 221);
    doc.setLineWidth(0.6);
    doc.line(margin, pageHeight - 38, pageWidth - margin, pageHeight - 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text("Generated locally by ACLimb - private session notes excluded", margin, pageHeight - 23);
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 23, { align: "right" });
  }

  return doc;
}

export function downloadACLimbPdf(data: ACLimbPdfData) {
  const generatedAt = new Date();
  const doc = buildACLimbPdf(data, generatedAt);
  doc.save(`aclimb-summary-${dateKey(generatedAt)}.pdf`);
}
