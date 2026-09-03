# ACLimb

**A gentle, installable physiotherapy-plan companion where every completed session moves a little trail companion forward.**

ACLimb helps adults follow instructions they have already received from a clinician. Users manually enter their plan, record what they complete, and see their effort reflected through trails, crafts, stamps, personal wins, and monthly postcards.

ACLimb records instructions and progress. It does **not** recommend exercises, interpret symptoms, judge clinical measurements, or change treatment.

## Project status

ACLimb is currently a functional, local-first MVP. It can be installed as a Progressive Web App (PWA) and used on one device without an account.

| Capability | Status |
| --- | --- |
| Manual plan creation and revisions | Working |
| Scheduled sessions and actual-rep logging | Working |
| Draft recovery and same-day corrections | Working |
| Trails, companion movement, crafts, stamps, wins, and recaps | Working |
| Home Screen installation | Working after HTTPS deployment |
| Accounts, invitations, cloud sync, and backup | Not connected yet |
| Scheduled push reminders | Service-worker receiver only; subscription and delivery backend still required |
| App Store distribution | Not included; ACLimb is currently a web-installed PWA |

The current build is suitable for product testing with non-sensitive sample data. Before asking beta users to rely on ACLimb for real records, add authenticated server storage, deletion/export controls, and production notification infrastructure.

## The experience

### Today

- Shows sessions generated from the active plan and the user’s actual local date.
- Supports multiple prescribed sessions per day and planned rest days.
- Displays a seven-day schedule strip and calculated weekly completion.
- Surfaces review-date reminders without ending or changing the plan.
- Shows the active trail, craft progress, recent keepsakes, and monthly recap.

### Session

- Preserves the exercise name, side, notes, sets, reps, and hold target prescribed in that plan revision.
- Records actual reps per set above or below the target without advice or extra rewards.
- Includes large decrement, increment, and Target controls plus an optional hold timer.
- Saves interrupted work as a recoverable draft.
- Requires every exercise to be completed or skipped before full-session progress is awarded.
- Saves partial sessions without advancing the trail.
- Supports same-day corrections, an optional `0–10` pain score, and a private note.
- Records clinician-directed, pain-related, scheduling, and other rest reasons without removing previously earned progress.

### My Plan

- Uses fully manual entry—no image or OCR data is collected.
- Supports exercise name, side, sets, reps, hold duration, and clinician notes.
- Supports weekdays and multiple daily session times.
- Requires one trail choice per plan revision: Woodland, Mountain, or Lakeside.
- Uses an effective date to control when a revision starts.
- Provides an optional review date that creates a reminder but never expires the plan.
- Keeps the current revision active until a future-dated revision takes effect.
- Preserves completed-session targets and history when a new revision is saved.

### Trail

- Moves Moss one step for each fully completed session in the active revision.
- Uses distinct Woodland, Mountain, and Lakeside scenery and wearables with equal requirements.
- Tracks one companion, one progress bar, and one active weekly craft.
- Awards adherence stamps from actual saved session history.
- Stores user-declared Personal Wins without interpreting their meaning.
- Shows neutral comparisons for repeated labels and units.
- Turns saved monthly recaps into dated postcards.

## Run locally

Requirements:

- A current Node.js installation
- npm

```bash
git clone git@github.com:srs-1/aclimb.git
cd aclimb
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The service worker is intentionally disabled during development so an old cached build does not hide new changes.

### Production verification

```bash
npm run build
npm start
```

No environment variables are required for the current local-only MVP.

## Make it shareable

The simplest preview deployment is Vercel:

1. Commit and push the project to GitHub.
2. Import the repository into Vercel.
3. Use the default Next.js build settings.
4. Open the generated HTTPS URL and test plan creation on a clean browser profile.
5. Share that URL with testers using sample data only until account storage and deletion controls are complete.

An HTTPS deployment activates the production service worker and makes the PWA installable.

## Install on a phone

### iPhone or iPad

1. Open the deployed ACLimb URL.
2. Open the browser’s Share menu.
3. Choose **Add to Home Screen**.
4. Confirm the name and add ACLimb.
5. Launch ACLimb from its Home Screen icon.

### Android

1. Open the deployed URL in Chrome.
2. Open the browser menu.
3. Choose **Install app** or **Add to Home screen**.
4. Launch ACLimb from its app icon.

Installing the PWA gives ACLimb a standalone app window, but it does not currently synchronize records between devices.

## Data and privacy

The MVP has no application backend and sends no ACLimb records to a server.

Durable state is stored in browser Local Storage under:

```text
aclimb-app-data-v1
```

That record contains the profile name, current plan, plan revisions, trail choices, sessions, actual reps, optional check-ins, keepsakes, recaps, and personal wins. Unfinished sessions use a separate per-session draft key and are cleared after a completed session or saved rest outcome.

Important limitations:

- Records belong to one browser profile on one device.
- Clearing site data, removing the browser profile, or losing the device can remove the records.
- There is no cloud backup, account recovery, or cross-device synchronization yet.
- Browser storage is not a substitute for a production authentication and data-protection design.
- Exercise data, pain values, personal wins, images, and OCR content are not sent to analytics; the MVP currently includes no analytics integration.

## Architecture

- **Application:** Next.js 16 App Router, React 19, and TypeScript
- **Interface:** responsive custom CSS with accessible system typography and Lucide icons
- **PWA:** web app manifest, standalone metadata, and a custom service worker
- **Persistence:** versioned Local Storage state plus temporary local session drafts
- **Artwork:** original route illustrations and a separate CSS companion sprite
- **Hosting target:** Vercel
- **Planned backend:** Supabase Auth and Postgres with owner-scoped Row Level Security
- **Planned notifications:** standards-based Web Push using VAPID and a scheduled delivery worker

```text
app/
├── globals.css       Global responsive UI and animation styles
├── layout.tsx       Metadata, viewport, and PWA links
├── manifest.ts     Installable-app manifest
└── page.tsx         Application entry page
components/
└── ACLimbApp.tsx   State model and Today, Session, Plan, and Trail flows
public/
├── icon.svg         ACLimb climbing-path mark
├── sw.js            Cache and notification event handling
└── *-route.png     Original trail artwork
```

## Production roadmap

- [x] Replace demo values with user-created plans and session records
- [x] Add effective-dated plan revisions and review dates
- [x] Make trail selection part of each plan revision
- [x] Add an install manifest, service worker, responsive layout, and reduced-motion support
- [ ] Add invite-only Supabase magic-link authentication
- [ ] Create the normalized Postgres schema and owner-scoped RLS policies
- [ ] Synchronize plans, sessions, rewards, wins, and recaps across devices
- [ ] Move unsynchronized session drafts to IndexedDB with cleanup controls
- [ ] Add Web Push subscription, VAPID APIs, timezone-aware scheduling, follow-ups, and snoozing
- [ ] Add logout, remove-device, notification revocation, data export, data deletion, and account deletion
- [ ] Add a privacy-safe **Report a problem** flow
- [ ] Add automated accessibility, unit, integration, and end-to-end tests
- [ ] Verify installed-PWA behavior on real iPhone and Android devices

## Safety boundary

ACLimb is a consumer adherence tool, not a medical-record system or clinical decision tool. It should only record a plan supplied by the user’s clinician. Product copy and future automation must never:

- prescribe or recommend an exercise;
- increase or decrease sets, reps, frequency, or hold duration;
- interpret pain, symptoms, or measurements;
- decide whether someone should continue or stop treatment; or
- replace advice from a qualified healthcare professional.

## Original artwork

The route artwork in `public/woodland-route.png`, `public/mountain-route.png`, and `public/lakeside-route.png` was created specifically for ACLimb. The scenery contains no copied game characters, maps, interface layouts, clinical imagery, or baked-in companion. Moss is rendered separately so movement is driven by saved progress rather than a static background.
