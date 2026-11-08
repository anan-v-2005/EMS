# EMS / HRMS – Deployment and Acceptance Checklist

## 1. Install dependencies

From the project root, install the frontend and backend separately:

```bash
cd server
npm ci
npm test
cd ../client
npm ci
npm run build
npm run lint
```

Resolve every failed test, build error, and lint error before deployment.

## 2. Backend environment

Copy `server/.env.example` to a private environment configuration and set:

- `NODE_ENV=production`
- `MONGODB_URI`
- `JWT_SECRET` (long random value, at least 32 characters)
- `CLIENT_URL` (exact deployed frontend origin; comma-separated only if multiple origins are intentionally supported)
- SMTP host, port, secure flag, username, password, and sender email
- `GEMINI_API_KEY` and optional `GEMINI_MODEL` / `GEMINI_TIMEOUT_MS`
- Cloudinary cloud name, API key, and API secret if profile photos or HR documents are enabled
- Inngest event/signing keys for scheduled functions

Never put real secrets in source control or in a `VITE_` variable.

## 3. Frontend environment

Set `VITE_BASE_URL` to the backend origin without `/api`, for example `https://your-api.example.com`. Set `VITE_AI_ENABLED=false` only if the AI assistant is intentionally disabled.

## 4. Database preparation

1. Take a verified backup before migration.
2. Run the documented legacy-data, salary, and payroll migrations only after reviewing their dry-run/output behavior for the target database.
3. Confirm employee `userId` links, salary structures, leave balances, attendance records, and published payslips.
4. Confirm required MongoDB indexes exist and review duplicate-key errors before enabling writes.
5. Verify restore from backup in a non-production environment.

## 5. Required end-to-end acceptance tests

- Admin and employee login, session refresh, role-based access, and logout confirmation.
- Admin attendance table, refresh, audit history, checkout correction, and manual auto-checkout both before and after configured shift end.
- Scheduled Inngest auto-checkout and recovery; confirm only still-open eligible sessions are closed and audit rows are created.
- Salary selection for employees with a current Salary document and employees using legacy salary fallback; ensure Leave Balance behavior remains unchanged.
- Compare analytics values with direct database queries for headcount, departments, attendance, leave, and published payroll.
- Add announcement and holiday; verify selected-month list, five-item cap, in-app notifications, SMTP delivery, and EmailLog outcomes.
- Forgot-password request, mailbox receipt, link expiry, successful reset, invalid/expired token, and subsequent login.
- Employee People Operations refresh and employee-only data scoping.
- Admin Profile 360, Admin-only Employee Analytics access control, all-employee view, individual view, search, and refresh.
- AI chatbot and insight latency under expected load, including Gemini timeout/fallback behavior.
- Browser regression tests at desktop and mobile widths; confirm existing desktop design remains unchanged.

## 6. Go-live gate

Do not mark the release complete until `npm test`, `npm run build`, and `npm run lint` pass, all required E2E tests pass against the target environment, SMTP and Inngest are verified, and backup/restore is demonstrated.
