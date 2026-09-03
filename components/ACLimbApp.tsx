"use client";

import Image from "next/image";
import {
  Award, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleCheck, Clock3, FileDown, Footprints, Gift, Heart, Leaf, Map, Minus, Mountain,
  Pause, PencilLine, Play, Plus, RotateCcw, ShieldCheck, Sparkles, Sprout,
  Timer, Trees, Trophy, Waves, X,
} from "lucide-react";
import { CSSProperties, ReactNode, useEffect, useState } from "react";

type Screen = "today" | "session" | "plan" | "trail";
type TrailLocation = "woodland" | "mountain" | "lakeside";
type ExerciseStatus = "active" | "completed" | "skipped";

type PlanExercise = {
  id: string;
  name: string;
  side: string;
  notes: string;
  reps: number;
  sets: number;
  holdSeconds?: number;
};

type Plan = {
  id: string;
  name: string;
  revision: number;
  effectiveDate: string;
  reviewDate?: string;
  trailLocation: TrailLocation;
  weekdays: number[];
  sessionTimes: string[];
  exercises: PlanExercise[];
  createdAt: string;
  updatedAt: string;
};

type ExerciseLog = {
  exerciseId: string;
  exerciseName: string;
  prescribedReps: number;
  prescribedSets: number;
  side: string;
  sets: number[];
  status: ExerciseStatus;
};

type SessionLog = {
  id: string;
  date: string;
  time: string;
  planRevision: number;
  status: "completed" | "partial" | "rest";
  exercises: ExerciseLog[];
  pain: number | null;
  note: string;
  restReason?: "clinician" | "pain" | "schedule" | "other";
  updatedAt: string;
};

type JourneyKeepsake = {
  id: string;
  kind: "stamp" | "postcard";
  icon: "sprout" | "footprints" | "mountain" | "award" | "postcard";
  label: string;
  earnedAt: string;
  tone: "mint" | "gold" | "sky" | "berry";
};

type PersonalWin = {
  id: string;
  label: string;
  value: string;
  unit: string;
  date: string;
  note: string;
};

type AppData = {
  version: 1;
  profileName: string;
  plan: Plan | null;
  planHistory: Plan[];
  sessions: SessionLog[];
  keepsakes: JourneyKeepsake[];
  wins: PersonalWin[];
  recaps: string[];
  trailLocation: TrailLocation;
};

const STORAGE_KEY = "aclimb-app-data-v1";
const emptyData: AppData = {
  version: 1,
  profileName: "",
  plan: null,
  planHistory: [],
  sessions: [],
  keepsakes: [],
  wins: [],
  recaps: [],
  trailLocation: "woodland",
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string) {
  return new Date(`${value}T12:00:00`);
}

function formatShortDate(value: string | Date = new Date()) {
  const date = typeof value === "string" ? dateFromKey(value) : value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date).toUpperCase();
}

function formatMonth(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, { month: "long" }).format(date);
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2020, 0, 1, hours, minutes));
}

function sessionId(date: string, time: string, revision: number) {
  return `${date}:${time}:r${revision}`;
}

function weekDates(date = new Date()) {
  const offset = (date.getDay() + 6) % 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
  return Array.from({ length: 7 }, (_, index) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index));
}

function scheduledTimes(plan: Plan | null, date: Date) {
  if (!plan || localDateKey(date) < plan.effectiveDate || !plan.weekdays.includes(date.getDay())) return [];
  return plan.sessionTimes;
}

function planForDate(plan: Plan | null, history: Plan[], date: Date) {
  const key = localDateKey(date);
  return [...history, ...(plan ? [plan] : [])]
    .filter((item) => item.effectiveDate <= key)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.revision - a.revision)[0] ?? null;
}

function weekStats(plan: Plan | null, sessions: SessionLog[], date = new Date(), history: Plan[] = []) {
  const days = weekDates(date);
  let expected = 0;
  let completed = 0;
  for (const day of days) {
    const effectivePlan = planForDate(plan, history, day);
    const key = localDateKey(day);
    for (const time of scheduledTimes(effectivePlan, day)) {
      const log = sessions.find((item) => item.id === sessionId(key, time, effectivePlan?.revision ?? 0));
      if (log?.status === "rest" && log.restReason === "clinician") continue;
      expected += 1;
      if (log?.status === "completed") completed += 1;
    }
  }
  return { days, expected, completed };
}

function monthlyStats(plan: Plan | null, history: Plan[], sessions: SessionLog[], wins: PersonalWin[], keepsakes: JourneyKeepsake[], date = new Date()) {
  const key = monthKey(date);
  const monthSessions = sessions.filter((item) => item.date.startsWith(key));
  const completed = monthSessions.filter((item) => item.status === "completed");
  const sets = completed.reduce((sum, item) => sum + item.exercises.filter((exercise) => exercise.status === "completed").reduce((setSum, exercise) => setSum + exercise.sets.length, 0), 0);
  const reps = completed.reduce((sum, item) => sum + item.exercises.filter((exercise) => exercise.status === "completed").reduce((repSum, exercise) => repSum + exercise.sets.reduce((a, b) => a + b, 0), 0), 0);
  let expectedToDate = 0;
  if (plan) {
    const cursor = new Date(date.getFullYear(), date.getMonth(), 1);
    while (cursor <= date) {
      const effectivePlan = planForDate(plan, history, cursor);
      const dayKey = localDateKey(cursor);
      for (const time of scheduledTimes(effectivePlan, cursor)) {
        const log = sessions.find((item) => item.id === sessionId(dayKey, time, effectivePlan?.revision ?? 0));
        if (!(log?.status === "rest" && log.restReason === "clinician")) expectedToDate += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const scheduleCompletion = expectedToDate ? Math.round((completed.length / expectedToDate) * 100) : 0;
  return {
    sessions: completed.length,
    sets,
    reps,
    scheduleCompletion,
    wins: wins.filter((item) => item.date.startsWith(key)).length,
    stamps: keepsakes.filter((item) => item.kind === "stamp" && item.earnedAt.slice(0, 7) === key).length,
  };
}

function upsertSession(sessions: SessionLog[], next: SessionLog) {
  const existing = sessions.findIndex((item) => item.id === next.id);
  if (existing < 0) return [...sessions, next];
  return sessions.map((item, index) => index === existing ? next : item);
}

function stamp(id: string, label: string, icon: JourneyKeepsake["icon"], tone: JourneyKeepsake["tone"], earnedAt = new Date().toISOString()): JourneyKeepsake {
  return { id, kind: "stamp", label, icon, tone, earnedAt };
}

function rewardsForSession(plan: Plan | null, history: Plan[], sessions: SessionLog[], completedSession: SessionLog) {
  const total = sessions.filter((item) => item.status === "completed").length;
  const awards: JourneyKeepsake[] = [];
  if (total === 1) awards.push(stamp("first-session", "First session", "sprout", "mint"));
  if ([5, 10, 25].includes(total)) awards.push(stamp(`${total}-sessions`, `${total} sessions`, "footprints", "gold"));
  if (dateFromKey(completedSession.date).getDay() === 0) awards.push(stamp(`sunday-${completedSession.date}`, "Sunday session", "award", "berry"));
  const week = weekStats(plan, sessions, dateFromKey(completedSession.date), history);
  if (week.expected > 0 && week.completed === week.expected) awards.push(stamp(`perfect-week-${localDateKey(week.days[0])}`, "Perfect prescribed week", "award", "berry"));
  const earlier = sessions.filter((item) => item.status === "completed" && item.id !== completedSession.id).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (earlier && (dateFromKey(completedSession.date).getTime() - dateFromKey(earlier.date).getTime()) / 86400000 >= 14) awards.push(stamp(`return-${completedSession.date}`, "Returned after a break", "sprout", "mint"));
  return awards;
}

function useStoredData() {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AppData;
        const normalizePlan = (plan: Plan | null) => plan ? { ...plan, trailLocation: plan.trailLocation ?? parsed.trailLocation ?? "woodland" } : null;
        setData({ ...emptyData, ...parsed, plan: normalizePlan(parsed.plan), planHistory: (parsed.planHistory ?? []).map((plan) => normalizePlan(plan)!) });
      }
      else {
        const legacyPlan = localStorage.getItem("aclimb-confirmed-plan");
        if (legacyPlan) {
          const parsed = JSON.parse(legacyPlan) as { name: string; exercises: Array<{ id: number; name: string; side: string; detail: string; target: number; sets: number[] }> };
          setData({ ...emptyData, plan: {
            id: newId("plan"), name: parsed.name, revision: 1, effectiveDate: localDateKey(), trailLocation: "woodland", weekdays: [1, 2, 3, 4, 5], sessionTimes: ["09:00"],
            exercises: parsed.exercises.map((item) => ({ id: String(item.id), name: item.name, side: item.side, notes: item.detail, reps: item.target, sets: item.sets.length })),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          } });
        }
      }
    } catch { setData(emptyData); }
    setReady(true);
  }, []);

  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data, ready]);
  return { data, setData, ready };
}

export default function ACLimbApp() {
  const { data, setData, ready } = useStoredData();
  const [screen, setScreen] = useState<Screen>("today");
  const [activeOccurrence, setActiveOccurrence] = useState<{ date: string; time: string } | null>(null);
  const [toast, setToast] = useState("");
  const [trailAnimationKey, setTrailAnimationKey] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    else {
      navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister()));
      if ("caches" in window) caches.keys().then((keys) => keys.filter((key) => key.startsWith("aclimb-")).forEach((key) => caches.delete(key)));
    }
  }, []);

  function navigate(next: Screen) {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2700);
  }

  function openSession(date: string, time: string) {
    setActiveOccurrence({ date, time });
    navigate("session");
  }

  function saveSession(log: SessionLog) {
    setData((current) => {
      const sessions = upsertSession(current.sessions, log);
      const newAwards = log.status === "completed" ? rewardsForSession(current.plan, current.planHistory, sessions, log) : [];
      const keepsakes = [...current.keepsakes, ...newAwards.filter((award) => !current.keepsakes.some((item) => item.id === award.id))];
      return { ...current, sessions, keepsakes };
    });
    if (log.status === "completed") {
      setTrailAnimationKey((value) => value + 1);
      navigate("trail");
      flash("Session complete — Moss moved forward!");
    } else {
      navigate("today");
      flash(log.status === "rest" ? "Today’s update was saved." : "Partial session saved for later.");
    }
  }

  function savePlan(nextPlan: Plan) {
    const isRevision = Boolean(data.plan);
    const startsLater = nextPlan.effectiveDate > localDateKey();
    setData((current) => ({
      ...current,
      plan: nextPlan,
      planHistory: current.plan ? [...current.planHistory, current.plan] : current.planHistory,
      keepsakes: [...current.keepsakes, stamp(`plan-${nextPlan.revision}-${nextPlan.updatedAt}`, isRevision ? "Clinician-updated plan" : "Plan started", "mountain", "sky", nextPlan.updatedAt)],
    }));
    localStorage.removeItem("aclimb-session-draft");
    navigate("today");
    flash(startsLater ? `Plan saved. It starts ${formatShortDate(nextPlan.effectiveDate)}.` : isRevision ? "Plan revision saved. Future sessions are updated." : "Plan saved. Your first schedule is ready.");
  }

  function saveRecap(key: string) {
    if (data.recaps.includes(key)) return;
    const now = new Date();
    setData((current) => ({ ...current, recaps: [...current.recaps, key], keepsakes: [...current.keepsakes, { id: `postcard-${key}`, kind: "postcard", icon: "postcard", label: `${formatMonth(now)} postcard`, tone: "sky", earnedAt: now.toISOString() }] }));
    flash("Monthly postcard added to your journey!");
  }

  async function downloadPdf() {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const { downloadACLimbPdf } = await import("@/lib/aclimbPdf");
      downloadACLimbPdf(data);
      flash("Your private PDF summary was downloaded.");
    } catch {
      flash("The PDF could not be created. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  }

  if (!ready) return <div className="loading-screen"><Brand /><span>Loading your trail…</span></div>;

  const occurrencePlan = activeOccurrence ? planForDate(data.plan, data.planHistory, dateFromKey(activeOccurrence.date)) : null;
  const activePlan = planForDate(data.plan, data.planHistory, new Date());

  return <div className="app-frame">
    <aside className="side-rail">
      <Brand />
      <nav aria-label="Primary navigation">
        <NavButton active={screen === "today"} icon={<CalendarDays />} label="Today" onClick={() => navigate("today")} />
        <NavButton active={screen === "plan"} icon={<PencilLine />} label="My plan" onClick={() => navigate("plan")} />
        <NavButton active={screen === "trail"} icon={<Map />} label="Trail" onClick={() => navigate("trail")} />
      </nav>
      <div className="rail-bottom"><div className="tiny-avatar">{(data.profileName || "A")[0].toUpperCase()}</div><div><strong>{data.profileName || "Your profile"}</strong><span>Saved on this device</span></div><ShieldCheck size={16} /></div>
    </aside>
    <main className={`page-shell ${screen === "session" ? "session-shell" : ""}`}>
      <div className="mobile-top"><Brand /><button className="icon-button" aria-label="Notifications"><Bell size={20} /></button></div>
      {screen === "today" && <TodayScreen data={data} exportingPdf={exportingPdf} onDownloadPdf={downloadPdf} onStart={openSession} onPlan={() => navigate("plan")} onTrail={() => navigate("trail")} onSaveRecap={saveRecap} />}
      {screen === "session" && occurrencePlan && activeOccurrence && <SessionScreen plan={occurrencePlan} occurrence={activeOccurrence} existing={data.sessions.find((item) => item.id === sessionId(activeOccurrence.date, activeOccurrence.time, occurrencePlan.revision))} onBack={() => navigate("today")} onSave={saveSession} />}
      {screen === "plan" && <PlanScreen plan={data.plan} profileName={data.profileName} onProfileName={(profileName) => setData((current) => ({ ...current, profileName }))} onSave={savePlan} />}
      {screen === "trail" && <TrailScreen data={data} animationKey={trailAnimationKey} onStart={() => { const times = scheduledTimes(activePlan, new Date()); const next = times.find((time) => !data.sessions.some((item) => item.id === sessionId(localDateKey(), time, activePlan?.revision ?? 0) && item.status === "completed")) ?? times[0]; if (next) openSession(localDateKey(), next); else navigate("today"); }} onPlan={() => navigate("plan")} onWin={(win) => setData((current) => ({ ...current, wins: [...current.wins, win] }))} />}
    </main>
    <nav className="bottom-nav" aria-label="Mobile navigation">
      <NavButton active={screen === "today" || screen === "session"} icon={<CalendarDays />} label="Today" onClick={() => navigate("today")} />
      <NavButton active={screen === "plan"} icon={<PencilLine />} label="Plan" onClick={() => navigate("plan")} />
      <NavButton active={screen === "trail"} icon={<Map />} label="Trail" onClick={() => navigate("trail")} />
    </nav>
    {toast && <div className="toast"><CircleCheck size={19} /> {toast}</div>}
  </div>;
}

function Brand() {
  return <div className="brand" aria-label="ACLimb"><span className="brand-mark"><span /></span><span>ACL<strong>imb</strong></span></div>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function KeepsakeArtwork({ keepsake, size = 18 }: { keepsake: JourneyKeepsake; size?: number }) {
  if (keepsake.icon === "sprout") return <Sprout size={size} />;
  if (keepsake.icon === "footprints") return <Footprints size={size} />;
  if (keepsake.icon === "award") return <Award size={size} />;
  return <Mountain size={size} />;
}

function TodayScreen({ data, exportingPdf, onDownloadPdf, onStart, onPlan, onTrail, onSaveRecap }: { data: AppData; exportingPdf: boolean; onDownloadPdf: () => void; onStart: (date: string, time: string) => void; onPlan: () => void; onTrail: () => void; onSaveRecap: (key: string) => void }) {
  const [recapOpen, setRecapOpen] = useState(false);
  const now = new Date();
  const todayKey = localDateKey(now);
  const week = weekStats(data.plan, data.sessions, now, data.planHistory);
  const stats = monthlyStats(data.plan, data.planHistory, data.sessions, data.wins, data.keepsakes, now);
  const currentMonthKey = monthKey(now);
  const month = formatMonth(now);
  const activePlan = planForDate(data.plan, data.planHistory, now);
  const futurePlan = [...data.planHistory, ...(data.plan ? [data.plan] : [])].filter((item) => item.effectiveDate > todayKey).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.revision - b.revision)[0];
  const times = scheduledTimes(activePlan, now);
  const currentRevisionSessions = data.sessions.filter((item) => item.status === "completed" && item.planRevision === activePlan?.revision).length;
  const step = Math.min(14, currentRevisionSessions);
  const trailLocation = activePlan?.trailLocation ?? "woodland";
  const theme = trailThemes[trailLocation];

  if (!data.plan) return <div className="screen today-screen">
    <header className="screen-header"><div><p className="eyebrow">{formatLongDate(now)}</p><h1>Welcome to ACLimb.</h1><p className="subtitle">Start by entering the exercises and schedule your clinician gave you.</p></div></header>
    <section className="empty-state card"><span><PencilLine /></span><h2>Create your first plan</h2><p>Your plan starts empty. ACLimb will only track the exercises, reps, and schedule you enter.</p><button className="primary-button" onClick={onPlan}><Plus /> Create my plan</button></section>
  </div>;

  if (!activePlan) return <div className="screen today-screen">
    <header className="screen-header"><div><p className="eyebrow">{formatLongDate(now)}</p><h1>Your plan is ready.</h1><p className="subtitle">It will become active on its effective date.</p></div></header>
    <section className="empty-state card"><span><CalendarDays /></span><h2>Starts {formatShortDate(futurePlan?.effectiveDate ?? data.plan.effectiveDate)}</h2><p>ACLimb will show scheduled sessions when this plan takes effect. You can review or correct the dates at any time.</p><button className="primary-button" onClick={onPlan}><PencilLine /> Review plan</button></section>
  </div>;

  const reviewDue = Boolean(activePlan.reviewDate && activePlan.reviewDate <= todayKey);
  const reviewSoon = Boolean(activePlan.reviewDate && activePlan.reviewDate > todayKey && dateFromKey(activePlan.reviewDate).getTime() - dateFromKey(todayKey).getTime() <= 7 * 86400000);
  const pendingRevision = data.plan.revision !== activePlan.revision && data.plan.effectiveDate > todayKey ? data.plan : null;

  return <div className="screen today-screen">
    <header className="screen-header"><div><p className="eyebrow">{formatLongDate(now)}</p><h1>{data.profileName ? `Hello, ${data.profileName}.` : "Ready for your next step?"}</h1><p className="subtitle">Your progress below is calculated from saved sessions.</p></div><button className="secondary-button pdf-download-button" onClick={onDownloadPdf} disabled={exportingPdf} aria-busy={exportingPdf}><FileDown size={17} /> {exportingPdf ? "Creating PDF…" : "Download PDF"}</button></header>
    {(reviewDue || reviewSoon) && <section className={`plan-date-banner ${reviewDue ? "due" : "upcoming"}`} role="status"><CalendarDays /><div><strong>{reviewDue ? "Plan review due" : `Plan review on ${formatShortDate(activePlan.reviewDate!)}`}</strong><p>{reviewDue ? `The review date was ${formatShortDate(activePlan.reviewDate!)}. Your schedule will continue until you enter updated clinician instructions.` : "This is a reminder only. It does not end or change your plan."}</p></div><button className="secondary-button" onClick={onPlan}>Review plan</button></section>}
    {pendingRevision && <section className="plan-date-banner pending" role="status"><Clock3 /><div><strong>Updated plan starts {formatShortDate(pendingRevision.effectiveDate)}</strong><p>Your current plan remains active until then.</p></div><button className="secondary-button" onClick={onPlan}>View revision</button></section>}
    <section className="today-grid">
      <div className="main-column">
        {times.length ? times.map((time, index) => {
          const log = data.sessions.find((item) => item.id === sessionId(todayKey, time, activePlan.revision));
          return <section className={`session-card ${log?.status === "completed" ? "completed-session" : ""}`} key={time}>
            <div className="session-card-top"><span className="pill berry"><Clock3 size={14} /> {formatTime(time)} · SESSION {index + 1}</span>{log && <span className="session-state">{log.status}</span>}</div>
            <div className="session-card-body"><div><p className="muted">{activePlan.exercises.length} {activePlan.exercises.length === 1 ? "exercise" : "exercises"}</p><h2>{activePlan.name}</h2><p className="exercise-preview">{activePlan.exercises.map((item) => item.name).join(" · ")}</p></div><button className={log?.status === "completed" ? "secondary-button light-button" : "primary-button"} onClick={() => onStart(todayKey, time)}>{log?.status === "completed" ? <PencilLine size={16} /> : <Play size={17} fill="currentColor" />}{log?.status === "completed" ? "Correct session" : log?.status === "partial" ? "Continue session" : "Start session"}</button></div>
          </section>;
        }) : <section className="planned-rest card"><span><Leaf /></span><div><span className="kicker">PLANNED REST DAY</span><h2>No session scheduled today</h2><p>Your next session will appear here on a scheduled day.</p></div></section>}

        <section className="card week-card"><div className="section-title"><div><span className="kicker">THIS WEEK</span><h3>{week.completed} of {week.expected} sessions</h3></div><span className="week-status">{week.expected && week.completed === week.expected ? "Week complete" : "In progress"}</span></div><div className="week-strip">{week.days.map((day) => {
          const key = localDateKey(day);
          const dayPlan = planForDate(data.plan, data.planHistory, day);
          const planned = scheduledTimes(dayPlan, day);
          const logs = planned.map((time) => data.sessions.find((item) => item.id === sessionId(key, time, dayPlan?.revision ?? 0)));
          const done = planned.length > 0 && logs.every((log) => log?.status === "completed" || (log?.status === "rest" && log.restReason === "clinician"));
          const isToday = key === todayKey;
          return <div className={`day ${isToday ? "today" : ""}`} key={key}><span>{new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(day)}</span><b className={done ? "done" : planned.length ? "pending" : "rest"}>{done ? <Check size={15} strokeWidth={3} /> : day.getDate()}</b><small>{isToday ? "Today" : planned.length ? `${planned.length}×` : "Rest"}</small></div>;
        })}</div></section>

        <section className="card monthly-card"><button className="recap-toggle" onClick={() => setRecapOpen((value) => !value)} aria-expanded={recapOpen}><span className="postcard-mini"><Mountain size={22} /></span><span><span className="kicker">{month.toUpperCase()} RECAP</span><strong>Look how far you’ve come</strong></span><ChevronDown className={recapOpen ? "rotate" : ""} /></button>{recapOpen && <div className="recap-grid"><div><strong>{stats.sessions}</strong><span>sessions</span></div><div><strong>{stats.sets}</strong><span>sets</span></div><div><strong>{stats.reps}</strong><span>actual reps</span></div><div><strong>{stats.scheduleCompletion}%</strong><span>schedule</span></div><div><strong>{stats.stamps}</strong><span>stamps</span></div><div><strong>{stats.wins}</strong><span>personal wins</span></div><button className="secondary-button" disabled={data.recaps.includes(currentMonthKey)} onClick={() => onSaveRecap(currentMonthKey)}>{data.recaps.includes(currentMonthKey) ? <Check size={16} /> : <Gift size={16} />}{data.recaps.includes(currentMonthKey) ? "Postcard saved" : "Save postcard"}</button></div>}</section>
      </div>
      <aside className="right-column">
        <section className="trail-preview" onClick={onTrail} role="button" tabIndex={0}><Image src={theme.asset} alt={`${theme.name} trail`} fill sizes="(max-width: 900px) 100vw, 360px" priority /><span className="today-moss" aria-hidden="true"><i /><b /></span><div className="trail-overlay"><div><span className="pill cream"><Trees size={13} /> {trailLocation.toUpperCase()} TRAIL</span><h3>{theme.name}</h3><p>{step} of 14 steps explored</p></div><button className="round-arrow" aria-label="Open trail"><ChevronRight /></button></div></section>
        <section className="card craft-card"><div className="section-title"><div><span className="kicker">MYSTERY CRAFT</span><h3>{week.expected && week.completed === week.expected ? "Wearable revealed!" : "Something cozy..."}</h3></div><span className="craft-icon"><Gift /></span></div><div className="craft-progress"><div className="pixels">{Array.from({ length: Math.max(1, week.expected) }, (_, index) => <i className={index >= week.completed ? "empty" : ""} key={index} />)}</div><span>{week.completed} of {week.expected} sessions</span></div><div className="progress-track"><span style={{ width: `${week.expected ? Math.min(100, (week.completed / week.expected) * 100) : 0}%` }} /></div><p>{week.expected ? "Complete every required session this week to reveal it." : "Add scheduled sessions to begin a craft."}</p></section>
        <section className="card keepsakes-card"><div className="section-title"><h3>Recent keepsakes</h3><button className="text-link" onClick={onTrail}>View all</button></div>{data.keepsakes.length ? <div className="stamp-row">{data.keepsakes.slice(-3).map((item) => <div key={item.id} className="stamp-wrap"><span className={`stamp ${item.tone}`}><KeepsakeArtwork keepsake={item} /></span><small>{item.label}</small></div>)}</div> : <p className="empty-copy">Complete sessions to earn your first marker.</p>}</section>
      </aside>
    </section>
  </div>;
}

function SessionScreen({ plan, occurrence, existing, onBack, onSave }: { plan: Plan; occurrence: { date: string; time: string }; existing?: SessionLog; onBack: () => void; onSave: (log: SessionLog) => void }) {
  const draftKey = `aclimb-session-draft:${sessionId(occurrence.date, occurrence.time, plan.revision)}`;
  const baseLogs = plan.exercises.map((exercise) => existing?.exercises.find((item) => item.exerciseId === exercise.id) ?? { exerciseId: exercise.id, exerciseName: exercise.name, prescribedReps: exercise.reps, prescribedSets: exercise.sets, side: exercise.side, sets: Array.from({ length: exercise.sets }, () => 0), status: "active" as ExerciseStatus });
  const [logs, setLogs] = useState<ExerciseLog[]>(baseLogs);
  const [current, setCurrent] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [pain, setPain] = useState<number | null>(existing?.pain ?? null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    if (existing) return;
    const saved = localStorage.getItem(draftKey);
    if (saved) try { setLogs(JSON.parse(saved) as ExerciseLog[]); } catch { /* ignore invalid draft */ }
  }, [draftKey, existing]);
  useEffect(() => { localStorage.setItem(draftKey, JSON.stringify(logs)); }, [draftKey, logs]);
  useEffect(() => { if (!timerRunning) return; const timer = window.setInterval(() => setTimerSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer); }, [timerRunning]);

  const exercise = plan.exercises[current];
  const log = logs[current];
  const allResolved = logs.every((item) => item.status !== "active");

  function adjust(setIndex: number, amount: number) {
    setLogs((items) => items.map((item, index) => index === current ? { ...item, status: "active", sets: item.sets.map((value, set) => set === setIndex ? Math.max(0, value + amount) : value) } : item));
  }

  function target(setIndex: number) {
    setLogs((items) => items.map((item, index) => index === current ? { ...item, status: "active", sets: item.sets.map((value, set) => set === setIndex ? exercise.reps : value) } : item));
  }

  function resolve(status: ExerciseStatus) {
    const updated = logs.map((item, index) => index === current ? { ...item, status } : item);
    setLogs(updated);
    if (current < logs.length - 1) setCurrent(current + 1); else setFinishing(true);
  }

  function createLog(status: SessionLog["status"], restReason?: SessionLog["restReason"]): SessionLog {
    return { id: sessionId(occurrence.date, occurrence.time, plan.revision), date: occurrence.date, time: occurrence.time, planRevision: plan.revision, status, exercises: logs, pain, note, restReason, updatedAt: new Date().toISOString() };
  }

  function finish() {
    localStorage.removeItem(draftKey);
    onSave(createLog(allResolved ? "completed" : "partial"));
  }

  if (restOpen) return <RestFlow onBack={() => setRestOpen(false)} onSave={(reason) => { localStorage.removeItem(draftKey); onSave(createLog("rest", reason)); }} />;
  if (finishing) return <div className="screen session-screen finish-screen"><header className="session-header"><button className="back-button" onClick={() => setFinishing(false)}><ChevronLeft /> Back</button><span className="session-progress-label">Session check-in</span><span /></header><section className="finish-card"><span className="big-check"><Check /></span><span className="kicker">{allResolved ? "SESSION READY" : "PARTIAL SESSION"}</span><h1>{allResolved ? "That’s today’s step." : "Save what you completed."}</h1><p>How you felt is private and optional. ACLimb records it without interpreting it.</p><fieldset><legend>Any pain during this session? <span>Optional</span></legend><div className="pain-scale">{Array.from({ length: 11 }, (_, value) => <button className={pain === value ? "selected" : ""} onClick={() => setPain(value)} key={value}>{value}</button>)}</div><div className="scale-labels"><span>No pain</span><span>Worst pain</span></div></fieldset><label className="field-label">Private note <span>Optional</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Anything you’d like to remember..." /></label><button className="primary-button wide" onClick={finish}>{allResolved ? "Finish & take a trail step" : "Save partial session"}<ChevronRight /></button></section></div>;

  return <div className="screen session-screen"><header className="session-header"><button className="back-button" onClick={onBack}><ChevronLeft /> Save draft & exit</button><span className="session-progress-label">{formatShortDate(occurrence.date)} · {formatTime(occurrence.time)} · Exercise {current + 1} of {plan.exercises.length}</span><button className="text-link" onClick={() => setRestOpen(true)}>I can’t complete today</button></header><div className="segmented-progress">{logs.map((item, index) => <button key={item.exerciseId} className={`${item.status} ${index === current ? "current" : ""}`} onClick={() => setCurrent(index)} aria-label={`Go to ${plan.exercises[index].name}`}><span /></button>)}</div><section className="exercise-panel"><div className="exercise-heading"><div><span className="pill soft">{exercise.side}</span><h1>{exercise.name}</h1><p>{exercise.notes || "Follow your clinician-provided instructions."}</p></div></div><div className="target-summary"><span><strong>{exercise.sets}</strong> sets</span><i /><span><strong>{exercise.reps}</strong> reps each</span>{exercise.holdSeconds ? <><i /><span><strong>{exercise.holdSeconds}s</strong> hold</span></> : null}</div><div className="sets-card"><div className="sets-header"><span>SET</span><span>ACTUAL REPS</span><span /></div>{log.sets.map((value, index) => <div className="set-row" key={index}><span className="set-number">{index + 1}</span><div className="stepper"><button onClick={() => adjust(index, -1)} aria-label={`Decrease set ${index + 1}`}><Minus /></button><strong>{value}</strong><button onClick={() => adjust(index, 1)} aria-label={`Increase set ${index + 1}`}><Plus /></button></div><button className="target-button" onClick={() => target(index)}>Target {exercise.reps}</button></div>)}</div>{exercise.holdSeconds ? <div className="timer-card"><div><span className="timer-icon"><Timer /></span><div><strong>Optional hold timer</strong><p>Manual seconds are always okay.</p></div></div><strong className="timer-time">{String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:{String(timerSeconds % 60).padStart(2, "0")}</strong><button className="secondary-button" onClick={() => setTimerRunning((value) => !value)}>{timerRunning ? <Pause /> : <Play />}{timerRunning ? "Pause" : "Start"}</button><button className="icon-button" onClick={() => { setTimerSeconds(0); setTimerRunning(false); }}><RotateCcw /></button></div> : null}<div className="session-actions"><button className="secondary-button skip" onClick={() => resolve("skipped")}>Skip this exercise</button><button className="primary-button" onClick={() => resolve("completed")}><Check /> Mark complete</button></div><button className="text-link partial-link" onClick={() => setFinishing(true)}>Finish or save partial session</button><p className="autosave"><ShieldCheck size={15} /> This draft is saved on this device as you go.</p></section></div>;
}

function RestFlow({ onBack, onSave }: { onBack: () => void; onSave: (reason: SessionLog["restReason"]) => void }) {
  const [reason, setReason] = useState<SessionLog["restReason"]>();
  const reasons: Array<[NonNullable<SessionLog["restReason"]>, string, string]> = [["clinician", "My clinician cancelled this session", "Removes it from this week’s requirement."], ["pain", "Pain or symptoms", "Keeps existing progress; adds no new progress."], ["schedule", "Scheduling conflict", "Saves an unplanned rest day with no reward."], ["other", "Other reason", "Saves an unplanned rest day with no reward."]];
  return <div className="rest-flow"><button className="back-button" onClick={onBack}><ChevronLeft /> Back to session</button><span className="rest-icon"><Heart /></span><h1>It’s okay to pause.</h1><p>Select what got in the way today. We’ll record it without changing anything you’ve already earned.</p><div className="reason-list">{reasons.map(([value, title, detail]) => <label className={reason === value ? "selected" : ""} key={value}><input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} /><span><strong>{title}</strong><small>{detail}</small></span><i>{reason === value && <Check />}</i></label>)}</div><button className="primary-button wide" disabled={!reason} onClick={() => reason && onSave(reason)}>Save today’s update</button></div>;
}

type ExerciseDraft = { id: string; name: string; reps: string; sets: string; side: string; notes: string; holdSeconds: string };

function PlanScreen({ plan, profileName, onProfileName, onSave }: { plan: Plan | null; profileName: string; onProfileName: (name: string) => void; onSave: (plan: Plan) => void }) {
  const initialEffectiveDate = plan && plan.effectiveDate > localDateKey() ? plan.effectiveDate : localDateKey();
  const [name, setName] = useState(plan?.name ?? "");
  const [effectiveDate, setEffectiveDate] = useState(initialEffectiveDate);
  const [reviewDate, setReviewDate] = useState(plan?.reviewDate && plan.reviewDate >= initialEffectiveDate ? plan.reviewDate : "");
  const [trailLocation, setTrailLocation] = useState<TrailLocation | "">(plan?.trailLocation ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(plan?.weekdays ?? [1, 2, 3, 4, 5]);
  const [times, setTimes] = useState<string[]>(plan?.sessionTimes ?? ["09:00"]);
  const [drafts, setDrafts] = useState<ExerciseDraft[]>(plan?.exercises.map((item) => ({ id: item.id, name: item.name, reps: String(item.reps), sets: String(item.sets), side: item.side, notes: item.notes, holdSeconds: item.holdSeconds ? String(item.holdSeconds) : "" })) ?? [{ id: newId("exercise"), name: "", reps: "", sets: "1", side: "Not specified", notes: "", holdSeconds: "" }]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [dateError, setDateError] = useState("");
  const [attemptedSave, setAttemptedSave] = useState(false);
  const weekdayOptions = [{ value: 1, label: "Mon" }, { value: 2, label: "Tue" }, { value: 3, label: "Wed" }, { value: 4, label: "Thu" }, { value: 5, label: "Fri" }, { value: 6, label: "Sat" }, { value: 0, label: "Sun" }];
  const trailOptions: Array<{ value: TrailLocation; name: string; description: string; asset: string; icon: ReactNode }> = [
    { value: "woodland", name: "Woodland", description: "Fernhill Path", asset: "/woodland-route.png", icon: <Trees /> },
    { value: "mountain", name: "Mountain", description: "Summit Steps", asset: "/mountain-route.png", icon: <Mountain /> },
    { value: "lakeside", name: "Lakeside", description: "Stillwater Loop", asset: "/lakeside-route.png", icon: <Waves /> },
  ];

  function update(id: string, field: keyof ExerciseDraft, value: string) { setDrafts((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item)); setInvalid((items) => items.filter((item) => item !== id)); }
  function addExercise() { setDrafts((items) => [...items, { id: newId("exercise"), name: "", reps: "", sets: "1", side: "Not specified", notes: "", holdSeconds: "" }]); }
  function save() {
    setAttemptedSave(true);
    const errors = drafts.filter((item) => !item.name.trim() || Number(item.reps) < 1 || Number(item.sets) < 1).map((item) => item.id);
    setInvalid(errors);
    const nextDateError = !effectiveDate ? "Add an effective date." : reviewDate && reviewDate < effectiveDate ? "Review date must be on or after the effective date." : "";
    setDateError(nextDateError);
    if (!name.trim() || nextDateError || !trailLocation || !weekdays.length || !times.some(Boolean) || errors.length) return;
    const now = new Date().toISOString();
    const sessionTimes = [...new Set(times.filter(Boolean))].sort();
    if (!sessionTimes.length) return;
    onSave({ id: plan?.id ?? newId("plan"), name: name.trim(), revision: (plan?.revision ?? 0) + 1, effectiveDate, reviewDate: reviewDate || undefined, trailLocation, weekdays, sessionTimes, exercises: drafts.map((item) => ({ id: item.id, name: item.name.trim(), reps: Number(item.reps), sets: Number(item.sets), side: item.side, notes: item.notes.trim(), holdSeconds: item.holdSeconds ? Number(item.holdSeconds) : undefined })), createdAt: plan?.createdAt ?? now, updatedAt: now });
  }

  return <div className="screen plan-screen"><header className="screen-header"><div><p className="eyebrow">MY PLAN</p><h1>{plan ? "Update your plan" : "Build your plan"}</h1><p className="subtitle">Enter only the schedule and exercises prescribed by your clinician.</p></div><span className="privacy-badge"><PencilLine /> Manual entry</span></header><section className="manual-plan-layout"><div className="manual-builder">
    <section className="card plan-name-card"><div className="profile-plan-row"><label className="field-label">Your first name <span>Optional</span><input value={profileName} onChange={(event) => onProfileName(event.target.value)} placeholder="How ACLimb should greet you" /></label><label className="field-label">Plan name *<input value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, Knee recovery" /></label><label className="field-label">Effective date *<input type="date" value={effectiveDate} onChange={(event) => { setEffectiveDate(event.target.value); setDateError(""); }} /><small>Sessions use this revision from this date.</small></label><label className="field-label">Review date <span>Optional</span><input type="date" min={effectiveDate} value={reviewDate} onChange={(event) => { setReviewDate(event.target.value); setDateError(""); }} /><small>A reminder only; it will not end the plan.</small></label></div>{dateError && <p className="field-error">{dateError}</p>}</section>
    <section className="card route-builder"><div><span className="kicker">CHOOSE YOUR TRAIL *</span><h2>Where will this plan take you?</h2><p>Each plan revision has one trail. You can choose another when you save a new revision.</p></div><div className="route-choice-grid" role="radiogroup" aria-label="Choose a trail for this plan">{trailOptions.map((option) => <button type="button" role="radio" aria-checked={trailLocation === option.value} className={trailLocation === option.value ? "selected" : ""} key={option.value} onClick={() => setTrailLocation(option.value)}><span className="route-choice-art"><Image src={option.asset} alt="" fill sizes="180px" /></span><span className="route-choice-copy">{option.icon}<span><strong>{option.name}</strong><small>{option.description}</small></span>{trailLocation === option.value && <CircleCheck />}</span></button>)}</div>{attemptedSave && !trailLocation && <p className="field-error">Choose a trail before saving your plan.</p>}</section>
    <section className="card schedule-builder"><div><span className="kicker">SCHEDULE</span><h2>When is this prescribed?</h2></div><div className="weekday-picker">{weekdayOptions.map((day) => <button className={weekdays.includes(day.value) ? "active" : ""} key={day.value} onClick={() => setWeekdays((items) => items.includes(day.value) ? items.filter((item) => item !== day.value) : [...items, day.value])}>{day.label}</button>)}</div><div className="session-times"><span>Daily session times</span>{times.map((time, index) => <div key={`${index}-${time}`}><input type="time" value={time} onChange={(event) => setTimes((items) => items.map((item, i) => i === index ? event.target.value : item))} />{times.length > 1 && <button onClick={() => setTimes((items) => items.filter((_, i) => i !== index))} aria-label="Remove session time"><X /></button>}</div>)}<button className="text-link" onClick={() => setTimes((items) => [...items, "18:00"])}><Plus /> Add another daily session</button></div>{(!weekdays.length || !times.some(Boolean)) && <p className="field-error">Choose at least one weekday and session time.</p>}</section>
    <div className="builder-heading"><div><span className="kicker">PRESCRIBED EXERCISES</span><h2>{drafts.length} {drafts.length === 1 ? "exercise" : "exercises"}</h2></div><span>Required fields are marked *</span></div><div className="manual-exercise-list">{drafts.map((exercise, index) => <section className={`card manual-exercise-card ${invalid.includes(exercise.id) ? "invalid" : ""}`} key={exercise.id}><div className="exercise-card-head"><div><span>{index + 1}</span><strong>Exercise {index + 1}</strong></div>{drafts.length > 1 && <button className="remove-exercise" onClick={() => setDrafts((items) => items.filter((item) => item.id !== exercise.id))}><X /> Remove</button>}</div><label className="field-label">Exercise name *<input value={exercise.name} onChange={(event) => update(exercise.id, "name", event.target.value)} placeholder="For example, Seated knee extension" /></label><div className="manual-number-row"><label className="field-label">Reps per set *<input type="number" min="1" value={exercise.reps} onChange={(event) => update(exercise.id, "reps", event.target.value)} /></label><label className="field-label">Number of sets *<input type="number" min="1" value={exercise.sets} onChange={(event) => update(exercise.id, "sets", event.target.value)} /></label><label className="field-label">Side<select value={exercise.side} onChange={(event) => update(exercise.id, "side", event.target.value)}><option>Left side</option><option>Right side</option><option>Both sides</option><option>Not specified</option></select></label></div><div className="exercise-notes-row"><label className="field-label">Hold seconds <span>Optional</span><input type="number" min="0" value={exercise.holdSeconds} onChange={(event) => update(exercise.id, "holdSeconds", event.target.value)} placeholder="0" /></label><label className="field-label">Clinician notes <span>Optional</span><textarea value={exercise.notes} onChange={(event) => update(exercise.id, "notes", event.target.value)} placeholder="Copy positioning or pacing instructions..." /></label></div>{invalid.includes(exercise.id) && <p className="field-error">Add a name, at least 1 rep, and at least 1 set.</p>}</section>)}</div><button className="add-exercise manual-add" onClick={addExercise}><Plus /> Add another exercise</button><div className="manual-plan-actions"><p><ShieldCheck /> ACLimb records these instructions without changing them.</p><button className="primary-button" onClick={save}><Check /> {plan ? "Save new revision" : "Save plan"}</button></div>
  </div><aside className="manual-plan-summary"><section className="card"><span className="summary-icon"><PencilLine /></span><span className="kicker">PLAN SUMMARY</span><h3>{name || "Untitled plan"}</h3><div className="plan-date-summary"><span><CalendarDays /> Effective</span><strong>{effectiveDate ? formatShortDate(effectiveDate) : "Not set"}</strong><span><Clock3 /> Review</span><strong>{reviewDate ? formatShortDate(reviewDate) : "Not set"}</strong><span><Map /> Trail</span><strong>{trailLocation ? trailLocation[0].toUpperCase() + trailLocation.slice(1) : "Not chosen"}</strong></div><div className="summary-count"><strong>{drafts.length}</strong><span>{drafts.length === 1 ? "exercise" : "exercises"}</span></div><ul>{drafts.filter((item) => item.name).map((item) => <li key={item.id}><span>{item.name}</span><strong>{item.sets || 0} × {item.reps || 0} reps</strong></li>)}</ul>{plan && <p className="revision-note">Saving creates revision {plan.revision + 1}, effective {effectiveDate ? formatShortDate(effectiveDate) : "when selected"}. Completed sessions keep their original targets.</p>}</section><section className="manual-help"><ShieldCheck /><div><strong>Enter only your prescribed plan.</strong><p>ACLimb tracks completion but never suggests exercises or changes reps.</p></div></section></aside></section></div>;
}

const trailThemes: Record<TrailLocation, { name: string; asset: string; weather: string; wearable: string; points: Array<{ x: string; y: string }> }> = {
  woodland: { name: "Fernhill Path", asset: "/woodland-route.png", weather: "Woodland morning", wearable: "Berry trail scarf", points: [{x:"18%",y:"78%"},{x:"24%",y:"72%"},{x:"31%",y:"70%"},{x:"37%",y:"66%"},{x:"43%",y:"62%"},{x:"49%",y:"58%"},{x:"55%",y:"53%"},{x:"61%",y:"48%"},{x:"67%",y:"43%"},{x:"72%",y:"38%"},{x:"77%",y:"33%"},{x:"82%",y:"28%"},{x:"86%",y:"23%"},{x:"90%",y:"18%"},{x:"94%",y:"14%"}] },
  mountain: { name: "Summit Steps", asset: "/mountain-route.png", weather: "Clear alpine air", wearable: "Alpine wool cap", points: [{x:"15%",y:"79%"},{x:"22%",y:"75%"},{x:"29%",y:"71%"},{x:"36%",y:"68%"},{x:"43%",y:"63%"},{x:"50%",y:"59%"},{x:"56%",y:"54%"},{x:"62%",y:"49%"},{x:"68%",y:"44%"},{x:"73%",y:"39%"},{x:"78%",y:"34%"},{x:"83%",y:"29%"},{x:"87%",y:"24%"},{x:"91%",y:"19%"},{x:"94%",y:"14%"}] },
  lakeside: { name: "Stillwater Loop", asset: "/lakeside-route.png", weather: "Breezy lakeside", wearable: "Lakeside sun hat", points: [{x:"19%",y:"80%"},{x:"25%",y:"76%"},{x:"32%",y:"72%"},{x:"39%",y:"69%"},{x:"46%",y:"65%"},{x:"52%",y:"61%"},{x:"58%",y:"56%"},{x:"64%",y:"51%"},{x:"69%",y:"46%"},{x:"74%",y:"41%"},{x:"79%",y:"35%"},{x:"83%",y:"30%"},{x:"87%",y:"25%"},{x:"91%",y:"20%"},{x:"94%",y:"15%"}] },
};

function TrailMover({ location, step, animate, replayKey }: { location: TrailLocation; step: number; animate: boolean; replayKey: number }) {
  const [moved, setMoved] = useState(!animate);
  const points = trailThemes[location].points;
  const to = points[Math.min(step, points.length - 1)];
  const from = points[Math.max(0, Math.min(step - 1, points.length - 1))];
  useEffect(() => { setMoved(!animate); if (!animate) return; const timer = window.setTimeout(() => setMoved(true), 240); return () => window.clearTimeout(timer); }, [animate, location, replayKey, step]);
  return <div className={`trail-mover ${moved ? "moved" : ""}`} style={{ "--from-x": from.x, "--from-y": from.y, "--to-x": to.x, "--to-y": to.y } as CSSProperties} aria-label={`Moss at trail step ${step}`}><span className="mover-shadow" /><span className="moss-sprite"><span className="moss-ear left" /><span className="moss-ear right" /><i className="moss-eye left" /><i className="moss-eye right" /><b className="moss-smile" /><span className="moss-scarf" /></span>{moved && animate && <span className="step-sparkles" aria-hidden="true">✦</span>}</div>;
}

function TrailScreen({ data, animationKey, onStart, onPlan, onWin }: { data: AppData; animationKey: number; onStart: () => void; onPlan: () => void; onWin: (win: PersonalWin) => void }) {
  const [replayKey, setReplayKey] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [winLabel, setWinLabel] = useState("");
  const [winValue, setWinValue] = useState("");
  const [winUnit, setWinUnit] = useState("");
  const [winDate, setWinDate] = useState(localDateKey());
  const [winNote, setWinNote] = useState("");
  const activePlan = planForDate(data.plan, data.planHistory, new Date());

  if (!data.plan) return <div className="screen trail-screen"><header className="screen-header"><div><p className="eyebrow">YOUR TRAIL</p><h1>Your trail begins with a plan.</h1></div></header><section className="empty-state card"><span><Map /></span><h2>No active trail yet</h2><p>Enter your prescribed plan to choose a route and begin tracking progress.</p><button className="primary-button" onClick={onPlan}>Create my plan</button></section></div>;
  if (!activePlan) return <div className="screen trail-screen"><header className="screen-header"><div><p className="eyebrow">YOUR TRAIL</p><h1>Your next trail is ready.</h1></div></header><section className="empty-state card"><span><CalendarDays /></span><h2>Starts {formatShortDate(data.plan.effectiveDate)}</h2><p>The trail begins when this plan revision becomes effective.</p><button className="primary-button" onClick={onPlan}>Review plan</button></section></div>;

  const trailLocation = activePlan.trailLocation;
  const theme = trailThemes[trailLocation];
  const completed = data.sessions.filter((item) => item.status === "completed" && item.planRevision === activePlan.revision).length;
  const step = Math.min(14, completed);
  const week = weekStats(data.plan, data.sessions, new Date(), data.planHistory);
  const visibleKeepsakes = showAll ? data.keepsakes : data.keepsakes.slice(-4);
  const latestWin = [...data.wins].sort((a, b) => b.date.localeCompare(a.date))[0];
  const previousWin = latestWin ? [...data.wins].filter((item) => item.id !== latestWin.id && item.label.toLowerCase() === latestWin.label.toLowerCase() && item.unit === latestWin.unit).sort((a, b) => b.date.localeCompare(a.date))[0] : undefined;
  const todaysTimes = scheduledTimes(activePlan, new Date());
  const todaysCompleted = todaysTimes.every((time) => data.sessions.some((item) => item.id === sessionId(localDateKey(), time, activePlan.revision) && item.status === "completed"));

  function saveWin() {
    if (!winLabel.trim()) return;
    onWin({ id: newId("win"), label: winLabel.trim(), value: winValue.trim(), unit: winUnit.trim(), date: winDate, note: winNote.trim() });
    setWinOpen(false); setWinLabel(""); setWinValue(""); setWinUnit(""); setWinNote("");
  }

  return <div className="screen trail-screen"><header className="screen-header"><div><p className="eyebrow">YOUR {trailLocation.toUpperCase()} TRAIL · PLAN REVISION {activePlan.revision}</p><h1>{theme.name}</h1><p className="subtitle">Every completed session moves Moss one step forward. This route was chosen with your plan.</p></div></header>
    <section className={`trail-hero ${trailLocation}`}><Image key={theme.asset} src={theme.asset} alt={`${theme.name} pixel-art scenery`} fill priority sizes="100vw" /><div className="trail-hero-shade" /><TrailMover key={`${trailLocation}-${animationKey}-${replayKey}`} location={trailLocation} step={step} animate={animationKey > 0 || replayKey > 0} replayKey={replayKey} /><div className="trail-top"><span className="pill cream"><Leaf /> {trailLocation.toUpperCase()} ROUTE</span><span className="weather">{theme.weather}</span></div><div className="trail-bottom"><div><span className="kicker light">CURRENT JOURNEY</span><h2>{step} of 14 steps explored</h2><div className="trail-progress"><span style={{ width: `${(step / 14) * 100}%` }}><i /></span></div></div>{animationKey > 0 ? <button className="replay-step" onClick={() => setReplayKey((value) => value + 1)}><RotateCcw /> Replay last step</button> : todaysTimes.length && !todaysCompleted ? <button className="primary-button golden" onClick={onStart}><Play fill="currentColor" /> Take today’s step</button> : null}</div></section>
    <section className="trail-content"><div className="trail-main"><section className="card craft-large"><div className="craft-picture"><div className="mystery-pixels">{week.expected > 0 && week.completed === week.expected ? "✓" : "?"}</div><span>{week.expected > 0 && week.completed === week.expected ? "REVEALED" : "STITCHING..."}</span></div><div className="craft-copy"><span className="kicker">THIS WEEK’S MYSTERY CRAFT</span><h2>{week.expected === 0 ? "Schedule sessions to begin" : week.completed === week.expected ? theme.wearable : `${week.expected - week.completed} ${week.expected - week.completed === 1 ? "session" : "sessions"} left`}</h2><p>Complete every required session this week to reveal and equip the wearable. Progress is calculated from your saved sessions.</p><div className="progress-track"><span style={{ width: `${week.expected ? (week.completed / week.expected) * 100 : 0}%` }} /></div><div className="craft-count"><span><Gift /> {week.completed} of {week.expected} sessions</span><strong>{week.expected > 0 && week.completed === week.expected ? "Equipped" : "In progress"}</strong></div></div></section>
      <section className="card keepsake-large"><div className="section-title"><div><span className="kicker">KEEPSAKES · {data.keepsakes.length}</span><h2>Markers from your journey</h2></div>{data.keepsakes.length > 4 && <button className="text-link" onClick={() => setShowAll((value) => !value)}>{showAll ? "Show recent" : `See all ${data.keepsakes.length}`}</button>}</div>{visibleKeepsakes.length ? <div className="keepsake-grid">{visibleKeepsakes.map((item) => item.kind === "postcard" ? <div className="postcard" key={item.id}><Mountain /><div><strong>{item.label}</strong><span>{formatShortDate(item.earnedAt.slice(0, 10))}</span></div></div> : <div className="keepsake earned-marker" key={item.id}><span className={`stamp ${item.tone}`}><KeepsakeArtwork keepsake={item} /></span><div><strong>{item.label}</strong><span>{formatShortDate(item.earnedAt.slice(0, 10))}</span></div><CircleCheck className="marker-earned" /></div>)}</div> : <p className="empty-copy">Complete your first full session to earn a trail stamp.</p>}</section>
    </div><aside className="trail-aside"><section className={`card companion-card ${trailLocation}`}><span className="kicker">TRAIL COMPANION</span><div className="companion-pixel"><span className="ear one" /><span className="ear two" /><i className="eye one" /><i className="eye two" /><b /></div><h3>Moss</h3><p>{week.expected > 0 && week.completed === week.expected ? `Wearing: ${theme.wearable}` : "Ready for the next step"}</p></section><section className="card wins-card"><div className="section-title"><div><span className="kicker">PERSONAL WINS · {data.wins.length}</span><h3>Things you noticed</h3></div><Trophy /></div>{latestWin && <div className="win-entry"><span><Award /></span><div><strong>{latestWin.label}{latestWin.value ? ` · ${latestWin.value}${latestWin.unit}` : ""}</strong><small>{previousWin?.value ? `${previousWin.value}${previousWin.unit} → ${latestWin.value}${latestWin.unit} · ` : ""}{formatShortDate(latestWin.date)}</small></div></div>}<p>Only you decide what counts as a win. ACLimb records it without judging measurements.</p><button className="secondary-button wide" onClick={() => setWinOpen(true)}><Plus /> Add a personal win</button></section></aside></section>
    {winOpen && <div className="modal-backdrop" onClick={() => setWinOpen(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setWinOpen(false)}><X /></button><span className="win-modal-icon"><Trophy /></span><h2>Mark a personal win</h2><p>You choose what this means. ACLimb simply keeps the memory.</p><label className="field-label">What did you notice? *<input value={winLabel} onChange={(event) => setWinLabel(event.target.value)} placeholder="For example, Knee bend" /></label><div className="form-row"><label className="field-label">Value <span>Optional</span><input value={winValue} onChange={(event) => setWinValue(event.target.value)} /></label><label className="field-label">Unit <span>Optional</span><input value={winUnit} onChange={(event) => setWinUnit(event.target.value)} placeholder="°, mile, min" /></label></div><label className="field-label">Date<input type="date" value={winDate} onChange={(event) => setWinDate(event.target.value)} /></label><label className="field-label">Private note <span>Optional</span><textarea value={winNote} onChange={(event) => setWinNote(event.target.value)} /></label><button className="primary-button wide" disabled={!winLabel.trim()} onClick={saveWin}><Sparkles /> Save my win</button></div></div>}
  </div>;
}
