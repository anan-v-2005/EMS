# EMS Upgrade Notes

This upgrade extends the existing project in place. It does not replace the existing auth, route tree, employee management, dashboards, attendance pages, leave pages, payslips, notifications, chatbot, or existing analytics route.

## Added

- Attendance policy config, shared attendance calculations, noon check-in cutoff, 18:05 and 23:55 IST Inngest auto-checkout, startup/history recovery, review flags and checkout audit records.
- Backward-compatible `Attendance.dateKey` IST day string plus a migration command; existing `Attendance.date` remains a Date because existing controllers and stored records depend on it.
- Leave policy validation (20 days), leave balance records, current-year initialization, yearly reset, weekday/holiday-aware request day counts, paid/LOP preview, atomic `$inc` balance reservations/releases, overlap checks, and absence-to-leave admin action.
- Job openings, candidates, applications with duplicate prevention and stage history, interview scheduling/feedback.
- Salary structures and monthly payroll snapshots; attendance/leave/holiday-derived monthly counts, PF calculation, LOP, overtime, bonus, draft/finalize locking and print-to-PDF view.
- Employee/admin analytics endpoints using MongoDB aggregation; admin overview uses a two-minute in-memory cache.
- New People Operations page and employee leave-balance cards; print page for payroll snapshots.
- `.env.example`, migration script, setup notes and pure helper tests.

## Verification performed here

- `node --check` passed for every server JavaScript file.
- `npm test` passed: 5 tests covering leave allocation total, payroll arithmetic/negative guard, and attendance calculations.
- TypeScript's JSX parser checked all 38 client JSX files with zero syntax diagnostics.
- Secret scan found no pasted credential values in the packaged project; no real `.env` or `node_modules` is included.

## Still requires verification on your machine / deployment

- Dependency installation, Vite production build and ESLint could not be run in this environment because `npm ci` timed out while fetching packages. Run `npm install`, `npm run lint`, and `npm run build` locally.
- Start with a development/staging MongoDB database and run `npm run migrate` once. Review any date-key conflicts printed by the migration.
- Verify Inngest function synchronization and execution logs after deployment; code registration alone cannot prove the hosted scheduler is running.
- Leave balance changes use atomic balance updates, but the leave document and balance are not wrapped in one multi-document transaction. For strict concurrent production workflows, complete transaction-level integration tests on a MongoDB replica set before using this for real payroll/leave decisions.
- Payroll print-to-PDF uses the browser print dialog, not a server-side PDF engine. Statutory tax amounts remain administrator inputs; obtain qualified review before using payslips for real payroll.
- Full end-to-end UI/API testing requires real authentication, MongoDB data, and configured external integrations (Inngest, SMTP, Gemini, Cloudinary).
