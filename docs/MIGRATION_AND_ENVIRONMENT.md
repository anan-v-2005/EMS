# Migration and environment setup

## Environment files

- Copy `server/.env.example` to `server/.env` and fill in private values.
- Copy `client/.env.example` to `client/.env`.
- Never commit `.env` files. Never place server secrets in `client/.env` or any `VITE_*` variable.

The server example documents MongoDB, JWT, client CORS origin, SMTP, Gemini, Cloudinary and Inngest settings. `GEMINI_TIMEOUT_MS` controls the bounded Gemini request timeout (default 15 seconds, clamped to 3–30 seconds).

## Database migration

The individual and comparison employee analytics endpoints use the existing Employee, Attendance, LeaveApplication, Payslip, Salary, PayrollSnapshot and PerformanceReview collections. The analytics notes feature adds the `EmployeeAnalyticsNote` collection; Mongoose creates its indexes on model initialization. The Employee schema now has optional `employmentType` and `reportingManager` fields. Existing documents remain valid without a migration: old employees retain `null`/unset values and should be classified by HR when appropriate. No historical employee, attendance, leave, salary or payslip records are reset. Missing leave balances are initialized using the shared prorated leave allocation policy.

For an existing installation, follow the current `README.md` compatibility steps before production rollout:

1. Take a MongoDB backup and confirm it can be restored.
2. Configure `MONGODB_URI` in the backend environment.
3. Run `npm run migrate` in `server` to backfill attendance date keys and initialize missing leave balances; inspect duplicate date-key conflicts reported by the script.
4. If the deployment has legacy payroll snapshots, review the migration notes and run `npm run migrate:payroll` only when those records need importing.
5. Run `npm run migrate:salary` only if the installation requires the salary-structure backfill described by that script; review skipped/out-of-range records.
6. Deploy the backend and frontend together. The Employee Analytics endpoint is code-only and needs no data migration.

Do not run migrations against production without a recent backup and a reviewed migration output.

## Local start commands

```bash
cd server
npm install
npm test
npm run dev
```

In a second terminal:

```bash
cd client
npm install
npm run dev
```

For frontend verification run `npm run lint` and `npm run build` after dependencies install successfully.

## Employee Analytics notes collection

The `EmployeeAnalyticsNote` Mongoose model creates its collection/indexes through the existing Mongoose model lifecycle. No employee, attendance, leave, salary or payslip records are rewritten. The first saved Admin note creates a document with employee reference, author reference, body and timestamps and an associated HR audit event. Back up MongoDB before production deployment and verify collection/index creation on staging.

## Clean dependency install and build

The ZIP intentionally excludes `node_modules`. On the target operating system, run:

```bash
cd client
npm ci
npm run lint
npm run build

cd ../server
npm ci
npm test
```

A platform-specific Rollup binary must be installed by npm for the OS/architecture running the Vite build. Do not copy Windows `node_modules` into a Linux deployment image (or vice versa).
