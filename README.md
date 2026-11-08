# Employee Management System (EMS)

A React + Vite employee/admin management application with an Express API, MongoDB/Mongoose, JWT role-based access, attendance, leave, holidays, payslips, analytics, Gemini-assisted insights/chat, Inngest workflows, SMTP email, and Cloudinary employee photos.

## Requirements

- Node.js 20 or newer and npm
- MongoDB local instance or MongoDB Atlas database
- SMTP credentials for email delivery (optional for login/basic local browsing, required for actual email delivery)
- Inngest account for deployed scheduled workflows; Inngest Dev Server for local scheduled-workflow testing

## 1. Configure the backend

```bash
cd server
npm install
```

Copy `server/.env.example` to `server/.env` and set at least:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/ems
JWT_SECRET=replace-with-a-long-random-secret
PORT=4000
CLIENT_URL=http://localhost:5173
ADMIN_EMAIL=admin@example.com
```

For a hosted database, replace `MONGODB_URI` with the MongoDB Atlas connection string and allow your development/deployment environment to connect in Atlas Network Access. Do not commit `.env` files or use the example JWT secret in production.

### Create the initial admin account

The seed script creates an admin using `ADMIN_EMAIL`. The password is `ADMIN_PASSWORD` if you set it, otherwise a random one is generated and printed once. The admin must change it on first login:

```bash
npm run seed
```

Change the password immediately after first login. Employee accounts are created through the existing Admin employee-management flow.

### Start the backend

```bash
npm run dev
```

The API is available at `http://localhost:4000`; `GET /` should return `Server is running`.

## 2. Configure and start the frontend

In a second terminal:

```bash
cd client
npm install
```

Copy `client/.env.example` to `client/.env` and set `VITE_BASE_URL=http://localhost:4000` for local development.

```bash
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

## 3. Scheduled attendance and reminder workflows

The backend exposes Inngest at `/api/inngest`. For local testing of scheduled jobs, run the backend and then start the Inngest Dev Server in another terminal:

```bash
npx inngest-cli@latest dev -u http://localhost:4000/api/inngest
```

Open the local Inngest dashboard and confirm the functions are registered. In production, configure the Inngest app to sync with your deployed backend's `/api/inngest` endpoint and set the Inngest environment variables if required by your deployment.

- **Auto-checkout:** runs at 6:05 PM and again at 11:55 PM `Asia/Kolkata`, closes open records at the 6:00 PM shift end, calculates working hours/day type, flags auto-closed rows for review, and records audit events. Past open records are swept at backend startup and when attendance history is fetched.
- **Attendance reminder:** runs daily at 11:30 AM `Asia/Kolkata` and emails active employees who have not checked in and are not on approved leave that day.
- **Leave review reminder:** reminds the Admin about pending leave applications after 24 hours.

Scheduled execution requires the Inngest Dev Server locally or a correctly synced Inngest production app. The scheduled triggers run only when the Inngest app is correctly synced and executing. Actual job execution and email delivery depend on the scheduler and SMTP provider being available. Core attendance actions also enforce approved-leave restrictions in the backend.

## 4. Email setup

Set the SMTP variables in `server/.env`. Example for Brevo SMTP:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SENDER_EMAIL=no-reply@your-verified-domain.example
```

Use credentials from your SMTP provider and a verified sender address. Email delivery failures are logged and do not undo the underlying attendance action. The app cannot send real email until valid SMTP credentials and sender configuration are supplied.

## 5. Optional integrations

- **Gemini:** configure `GEMINI_API_KEY` and, if needed, `GEMINI_MODEL`.
- **Cloudinary photos and HR documents:** configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. HR documents are uploaded as authenticated assets and are opened through short-lived signed download links after an ownership check. Never expose the API secret in frontend configuration.
- **Vercel:** deploy frontend and backend separately according to their existing Vercel configuration files; configure environment variables in each deployment. Ensure the Inngest production app is synced to the deployed backend endpoint.

## Implemented attendance and UX safeguards

- Approved leave overlapping today's India-local date blocks starting a new attendance session. An already-open session remains closable so an employee is not trapped with an unclosed attendance record if leave is approved after check-in.
- Deleted/inactive employees are rejected during backend login and attendance authorization.
- Notification dropdown and AI assistant close when the user clicks outside them; existing close controls remain.
- AI insight text areas scroll vertically without changing the existing card design.
- Attendance date/employee and leave date/status indexes support common attendance and approved-leave lookups.

## Validation

```bash
cd server
node --check server.js
```

Frontend quality checks:

```bash
cd client
npm run lint
npm run build
```

For production, test the full login, attendance, leave, scheduled Inngest execution, and email flows with your actual environment configuration before inviting users.


## 6. People Operations modules

The new `/people-operations` route is integrated into the existing authenticated app and exposes these additions through `/api/enterprise`:

- Leave balances: 20-day annual allocation (7 sick, 7 casual, 3 emergency, 3 annual), initializes current-year records on startup, and resets balances annually through Inngest. Leave requests reserve paid days and calculate excess days as LOP. Weekends and configured holidays are excluded from day counts.
- Payslips & payroll: one draft → review → finalize → publish workflow on the Payslips page (see *Payslips & payroll* below).
- Salary structures: the single source of truth for pay. Salary entered when creating or editing an employee is stored as a salary structure (effective from the join date on creation, from today on later edits), and every screen reads it from there. Phone numbers must have 7-15 digits and each monthly salary amount is limited to ₹1,00,00,000 (see `server/constants/limits.js`). On startup, employees that only had pay on their Employee record get a structure automatically.
- Attendance review: auto-checkout badges, admin checkout correction and audit history.

### Compatibility and migration

The original `Attendance.date` field is a MongoDB `Date` and is used by the existing UI and APIs. To avoid silently breaking existing records, this upgrade adds canonical `dateKey` (`YYYY-MM-DD` in Asia/Kolkata) for new attendance records instead of changing the old field type in place. After configuring `server/.env`, run this one-time migration:

```bash
cd server
npm run migrate
```

The migration backfills missing attendance date keys and initializes missing current-year leave balances. Review any reported duplicate date-key conflicts before deploying. Existing legacy `Payslip` records keep working unchanged (they are treated as finalized). Older `PayrollSnapshot` records can be copied into Payslips with `npm run migrate:payroll`.

### Important implementation scope

- Payroll is now generated from the Payslips page; see *Payslips & payroll* below. The browser Print dialog (Save as PDF) is used for PDFs.
- Leave balance reservation and leave status transitions are implemented at application level; for high-concurrency production use, wrap leave + balance updates in MongoDB transactions or conditional atomic updates and validate them against a replica-set MongoDB deployment.
- The legacy analytics route and dashboards are preserved, and dedicated employee/admin analytics endpoints have been added using MongoDB aggregation pipelines. The frontend still uses its existing chart components; Recharts and React Query have not been added.
- The included automated tests cover the core payroll arithmetic and attendance calculation helpers. They do not replace full integration tests against a configured MongoDB, Inngest and SMTP environment.

## 7. Tests and verification

```bash
cd server
npm test
node --check server.js

cd ../client
npm install
npm run lint
npm run build
```

Do not commit secrets. All values in `server/.env.example` are placeholders; copy it to `server/.env` and add your own rotated credentials.


## Payslips & payroll

**Workflow:** *Generate* (draft) → *review warnings* → *Finalize* (publishes to the employee, sends an in-app notification and email) → *Print / Save as PDF*.
Employees only ever see finalized payslips. A finalized payslip can be reopened (reason required, audit-logged) and a draft can be edited, regenerated or deleted.

**What is calculated automatically (From attendance mode)**

- Gross from the salary structure in force on each day (mid-month revisions are paid pro-rata; superseded structures are kept for back-dated months; falls back to the salary on the employee record).
- Loss of pay: absent days, half-days (4–8 h), days before the join date, LOP portion of approved leave, optional "N late marks = half-day" rule. Per-day pay = gross ÷ calendar days (default) or working days.
- Weekly offs and company holidays are never LOP (optional holidays are not treated as days off). Approved paid leave is paid.
- Overtime beyond the configured hours (rate = per-day pay ÷ standard hours × multiplier, or an explicit rate you type).
- Bonus, other earnings/deductions, TDS (entered by you), recurring deduction from the employee record.
- Optional PF, ESI and professional tax (all **off by default** – enable and verify rates under *Payslips → Settings*).
- Net pay never goes negative; any shortfall and data-quality issues (open check-outs, auto-closed records awaiting review, month not yet ended) are shown as warnings.
- *Manual mode* keeps the old "type basic/allowances/deductions" behaviour for contractors or exceptional cases.

**Other features:** live calculation preview, bulk generate / bulk finalize for a month, filters and totals, payroll settings (company details, weekly offs, pay-days basis, overtime, late marks, PF/ESI/PT), full audit history per payslip.

**Settings that now apply everywhere:** *Weekly off days* (default Sunday only) are used by attendance check-in, leave day counting and payroll. Saturday is a normal working day by default; configure additional weekly offs under Payslips → Settings if your organisation observes them.

**API (admin unless noted):** `GET /api/payslips` (employees: own finalized only) · `GET /api/payslips/:id` · `POST /api/payslips` · `POST /api/payslips/preview` · `POST /api/payslips/bulk` · `POST /api/payslips/bulk-finalize` · `POST /api/payslips/:id/finalize` · `POST /api/payslips/:id/reopen` · `DELETE /api/payslips/:id` (drafts) · `GET|PUT /api/payslips/settings`.
The old payroll-snapshot endpoints and Payroll history tab have been removed. `PayrollSnapshot` is retained as a historical source for finalized overtime analytics; do not delete `models/PayrollSnapshot.js` while using Employee Analytics. Run `npm run migrate:payroll` if your deployment still needs the legacy snapshot-to-payslip migration.

**Tests:** `cd server && npm test` (engine rules, settings validation, and the data-gathering layer against fake models).


## 7. Change log (this revision)

**Security**
- Every request now re-checks the account in the database: archived/deactivated employees and demoted admins lose access immediately (previously up to 7 days).
- Password changes/resets revoke older tokens. Login is rate-limited; security headers added; unknown routes return JSON 404; a global error handler hides stack traces.
- Login checks the password before revealing role/status. Seed admin no longer uses a fixed password; new accounts, admin password resets and the seeded admin must choose a new password on first login.
- Single bcrypt library (`bcryptjs`). Use `npm ci` in each of `client` and `server` to install the exact lockfile dependencies for your deployment OS.

**Email**
- Forgot password / reset password (`/forgot-password`, `/reset-password`) and a welcome email with a set-password link for new employees. **Forgot Password is available to Employees only**; the Admin login page does not show it and the API never issues reset links for Admin accounts (an administrator can reset another admin from Employees -> Edit -> Change password). It needs SMTP (`SMTP_USER`, `SMTP_PASS`, `SENDER_EMAIL`) to be configured; otherwise the API answers 503.
- Security emails when a password is changed. "Profile updated" emails only when something actually changed, and they list what changed.
- Leave decisions include dates, loss-of-pay days and the reviewer's reason. Leave reminders go to all admins.
- Retries with exponential backoff and a delivery log (`EmailLog`, admin API: `GET /api/email-logs`).
- Attendance reminders skip weekends, holidays and admin accounts. Admins get a daily digest at 6:30 PM (absent, pending leave, records needing review). Per-employee auto-checkout emails are off unless `AUTO_CHECKOUT_EMAIL_EMPLOYEES=true`.

**Leave logic**
- Pro-rata allocation for mid-year joiners; capped carry-forward of unused annual leave (`config/leavePolicy.js`); minimum notice for casual/annual leave; rejection requires a reason; reviewer, time and note are stored.

**Removed**
- Recruitment (jobs, candidates, applications, interviews), the legacy payroll-snapshot endpoints/tab/print page, the commented-out login code, and the "recruitment funnel" placeholder.
- The optional AI assistant can be switched off with `AI_ENABLED=false` (server) and `VITE_AI_ENABLED=false` (client).

**Salary data**
- `npm run migrate:salary` (dry run) / `npm run migrate:salary -- --apply` converts old per-employee salary fields into proper salary structures. The old fields are kept until you have run it.

## 8. HRMS workspace

The `/hrms` workspace adds employee documents, performance reviews, approvals, lifecycle history and an HRMS audit view. Document upload requires Cloudinary credentials and stores authenticated assets; document downloads are generated as short-lived signed URLs after employee ownership/admin authorization. Leave and document-verification approvals are linked to their source records; general requests are tracked as decisions. Effective resignation/termination events deactivate employee login, and reactivation restores it. Other lifecycle events are recorded as HR history and should be paired with the existing employee/salary edit workflows when they change core employment or compensation data.

The HRMS feature and its dependencies are documented in `docs/FINAL_DELIVERY_NOTES.md`. Use a staging database to validate document uploads, leave approval balance changes, lifecycle access changes, and notifications before production rollout.


### Auto-checkout shift configuration

The shipped `server/config/attendancePolicy.js` sets `SHIFT_END` to `18:00`. The scheduled workflow reads this value and does not close records before the configured shift end. The original request mentioned 8 PM as an intended policy, but also required preserving a valid existing shift configuration; the existing 18:00 setting was therefore retained. If HR confirms an 8 PM shift end, update `SHIFT_END` and test the scheduled workflow in Inngest staging before production.
