# EnviSys

**A Digital Thesis Management and Real-Time Collaboration System for the Environmental Science Department**

EnviSys is a web-based platform that digitizes the thesis lifecycle of the Environmental Science Department (USTP–CDO): group formation, adviser and panel assignment, topic proposal and approval, document collaboration through Google Docs/Drive, stage tracking across Concept → Proposal → Final Defense, defense scheduling and evaluation, notifications, and secure digital archiving.

Built as a BSIT capstone project (January 2026), rebuilt and enhanced for this repository — the original manuscript's design is fully implemented, then extended with a native real-time layer, milestones with automated deadline reminders, departmental progress reporting, and a browsable thesis archive.

## Beyond the manuscript

The capstone paper delegated all real-time collaboration to Google Workspace and listed deadlines, monitoring, and archiving as goals without mechanisms. This rebuild closes those gaps:

- **Native real-time collaboration (WebSockets / Django Channels)** — every thesis group has a live discussion thread shared by students, the adviser, and approved panel members, with membership enforced at the socket. Notifications are pushed instantly (toast + badge) instead of polling. Google Docs integration remains for manuscript editing, but the system no longer depends on Google to be collaborative.
- **Milestones & deadline reminders** — dated targets per group per stage, one-click completion, overdue highlighting, and a `send_deadline_reminders` command for daily cron/Render Cron scheduling.
- **Progress reporting** — a `/api/reports/summary/` endpoint drives dashboard analytics: groups per stage, pending reviews, defense pipeline, overdue milestones, and (for the chairperson) approval queues and archive counts.
- **Digital archive repository** — a searchable, read-only archive of completed theses with their members, advisers, approval records, and versioned document links.
- **Review dialogs** — evaluations, verdicts, and feedback use proper accessible dialogs (keyboard-dismissable, focus-managed), not browser prompts.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, Lucide icons, Sonner toasts |
| Backend | Django 5 + Django REST Framework, SimpleJWT (stateless auth), Django Channels (WebSockets) |
| Database | SQLite by default (zero config) — PostgreSQL or MySQL via `DATABASE_URL` |
| Email | Brevo transactional email (console fallback in development) |
| Collaboration | Google OAuth + Google Drive/Docs API (optional, off by default) |
| Deployment | Netlify (frontend) + Render (backend) — plain `runserver` locally |

No Docker, no extra services. Two terminals and you're running.

## Quick start

### 1. Backend (Python 3.11+)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # defaults work out of the box (SQLite)
python manage.py migrate
python manage.py seed_demo       # demo accounts, password: envisys123
python manage.py runserver
```

API is now at `http://localhost:8000/api/` (health check: `/api/health/`).

### 2. Frontend (Node 18+)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173` and sign in with a demo account:

| Role | Email | Password |
|---|---|---|
| Department Chairperson (Admin) | `chair@ustp.edu.ph` | `envisys123` |
| Faculty (Adviser/Panel) | `adviser1@ustp.edu.ph` | `envisys123` |
| Student | `student1@ustp.edu.ph` | `envisys123` |

## How the workflow runs

1. **Students** register with their institutional email, verify it, and create a thesis group. Members can be added or removed freely — no hard-coded group size.
2. The group selects an **adviser** from a directory of verified faculty showing each adviser's specialization and current workload. One adviser per group, enforced.
3. The group **proposes a thesis topic**; the adviser approves or rejects it with feedback. Every transition (Pending → Approved/Rejected) is recorded in the status history.
4. Members **link thesis documents** hosted on Google Docs/Drive (EnviSys deliberately has no built-in editor — writing happens in Google Workspace, tracking happens here). Documents carry version lineage; a revision request produces v2, v3, and so on.
5. The adviser **nominates panel members**; nominations only become official after the **chairperson validates** them.
6. When the group is ready, it's **marked ready for defense**; faculty **propose a schedule** (date, time, duration, location) and the chairperson confirms it. Students and panel members are notified in-app and by email.
7. Panel members record **evaluations**, the chairperson records the **final result**, and the group advances to the next stage — Concept → Proposal → Final Defense.
8. Completed theses are **archived** with their metadata, version history, approval records, and Drive links intact. Every significant action lands in the **audit log**.

## Project structure

```
envisys/
├── backend/
│   ├── envisys_backend/        # Django project (settings, root urls)
│   └── apps/
│       ├── accounts/           # Custom User + roles, JWT auth, email verification,
│       │                       #   adviser directory with workload counts
│       ├── groups/             # ThesisGroup, GroupMember, PanelAssignment
│       ├── theses/             # ThesisTopic + ThesisStatusHistory
│       ├── documents/          # ThesisDocument with version lineage + Drive links
│       ├── defenses/           # DefenseSchedule, Evaluation, DefenseResult
│       ├── notifications/      # In-app notifications + Brevo email service
│       ├── audit/              # ActivityLog for accountability
│       ├── integrations/       # Google OAuth flow + Drive folder/doc creation
│       ├── collaboration/      # Live discussion threads (WebSocket consumers,
│       │                       #   JWT socket auth) + REST fallback
│       └── reports/            # Departmental progress summary endpoint
└── frontend/
    └── src/
        ├── api/                # Axios client (JWT refresh) + typed service modules
        ├── components/         # Layout, StageRail, StatusBadge, ActionDialog,
        │                       #   Discussion (live), Milestones, NotificationBell (live)…
        ├── context/            # AuthContext
        └── pages/              # Login/Register/Verify, Dashboard, Groups,
                                #   GroupDetail, Documents, Schedules, Archive,
                                #   Admin, Settings
```

## Configuration

Everything optional stays optional. The backend `.env` controls:

- `DATABASE_URL` — leave empty for SQLite; set `postgres://…` (Render) or `mysql://…` (local MySQL) to switch. Uncomment the matching driver in `requirements.txt`.
- `BREVO_API_KEY` — leave empty and verification/notification emails print to the console; set it and they're delivered via Brevo.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — leave empty and the app works fine with pasted Google Docs links; set them (plus the redirect URI in Google Cloud Console) to enable one-click "Create Google Doc" and per-group Drive folders. Uncomment the Google libraries in `requirements.txt`.
- `INSTITUTIONAL_EMAIL_DOMAIN` — the domain students must register with (default `ustp.edu.ph`).

## Real-time architecture

`python manage.py runserver` serves HTTP *and* WebSockets (Daphne/ASGI). Socket routes:

- `ws://…/ws/notifications/?token=<JWT>` — per-user notification push
- `ws://…/ws/groups/<id>/?token=<JWT>` — group discussion room (membership enforced server-side)

The in-memory channel layer requires no external service for a single-process deployment; swap in `channels_redis` for multi-worker setups. The frontend degrades gracefully: if a socket drops, discussion posting and notification counts fall back to REST.

## Deployment

- **Backend → Render:** uncomment `psycopg2-binary` in `requirements.txt`, set `DATABASE_URL` to the Render PostgreSQL URL and `DEBUG=False`, and run `daphne -b 0.0.0.0 -p $PORT envisys_backend.asgi:application` so WebSockets work in production. WhiteNoise serves static files. Add a Render Cron Job for `python manage.py send_deadline_reminders`.
- **Frontend → Netlify:** build command `npm run build`, publish directory `dist`, and set `VITE_API_URL` to the Render backend URL.

## Roles at a glance

| Capability | Student | Faculty | Chairperson |
|---|:-:|:-:|:-:|
| Create/join group, edit thesis title | ● | | ● |
| Submit topics and link documents | ● | | ● |
| Approve topics/documents, request revisions | | ● | ● |
| Nominate panel members | | ● | ● |
| Validate panel nominations | | | ● |
| Propose defense schedules | | ● | ● |
| Approve schedules, record results, advance stage | | | ● |
| Create/verify faculty accounts, archive theses, view audit log | | | ● |

## License

Academic project — University of Science and Technology of Southern Philippines, College of Information Technology and Computing.
