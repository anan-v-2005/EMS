# EMS API reference — relevant routes

All routes are mounted under `/api`. Authenticated routes require the bearer JWT. Admin-only routes additionally enforce the ADMIN role on the server.

## Authentication and password recovery

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public | Authenticate user and return JWT |
| POST | `/auth/forgot-password` | Public, rate-limited | Request an employee password reset email |
| POST | `/auth/reset-password` | Public, rate-limited | Validate single-use reset token and set new password |
| GET | `/auth/session` | Authenticated | Read current session |
| POST | `/auth/change-password` | Authenticated | Change current password |

## Attendance and People Operations

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/attendance?limit=100` | Authenticated | Attendance history (admin sees workforce; employee sees own) |
| POST | `/attendance` | Authenticated | Check in or check out |
| GET | `/enterprise/attendance/:id/audit` | Admin | Read audit events for an attendance record |
| POST | `/enterprise/attendance/run-auto-checkout` | Admin | Close eligible open records after configured shift end |
| PATCH | `/enterprise/attendance/:id/checkout` | Admin | Correct checkout time with audit event |
| GET | `/enterprise/salary-structures?employee=:id` | Admin | List salary structures, optionally for one employee |
| POST | `/enterprise/salary-structures` | Admin | Create salary structure |
| PATCH | `/enterprise/salary-structures/:id` | Admin | Update salary structure |
| GET | `/enterprise/leave-balances` | Authenticated | Read leave balances (admin workforce view or own employee view) |

## Analytics

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/analytics` | Authenticated | Live admin or employee analytics payload |
| GET | `/analytics/employee/summary` | Authenticated employee | Own employee summary |
| GET | `/analytics/employee/attendance?year=YYYY` | Authenticated employee | Own monthly attendance breakdown |
| GET | `/analytics/employee/leaves?year=YYYY` | Authenticated employee | Own monthly leave breakdown |
| GET | `/analytics/admin/overview` | Admin | Aggregated workforce overview |
| GET | `/analytics/admin/attendance?year=YYYY&department=...` | Admin | Monthly attendance breakdown |
| GET | `/analytics/admin/leaves?year=YYYY` | Admin | Monthly leave breakdown |
| GET | `/analytics/admin/comparison?range=7d\|30d\|month\|quarter\|year&department=...&designation=...&status=...&employeeIds=id1,id2` | Admin | Filtered workforce comparison using saved attendance, approved leave, submitted performance reviews and current salary structures |\n| GET | `/analytics/admin/employees/:employeeId` | Admin | Live 12-month individual employee analytics including current-year leave balances when initialized |

The comparison endpoint returns summary metrics, employee rows, recorded attendance trends, per-employee leave-category totals, finalized-payroll overtime where present, and current active salary structure values. Custom date ranges require both `startDate` and `endDate`. Attendance percentages are calculated from recorded attendance rows, not inferred expected working days. The individual analytics endpoint returns employee profile fields, attendance metrics and trend, leave utilization, published payslip totals/trend, department headcount contribution, saved performance reviews and current-year leave balances. Payroll/employee data is admin-only.

## Announcements, holidays and AI

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET/POST | `/announcements` | Authenticated / Admin for POST | List announcements / create and notify |
| PATCH | `/announcements/:id/toggle` | Admin | Activate/deactivate announcement |
| GET | `/holidays?year=YYYY` | Authenticated | List holidays for a year |
| POST | `/holidays` | Admin | Create holiday and notify |
| PATCH/DELETE | `/holidays/:id` | Admin | Update/delete holiday |
| POST | `/ai/chat` | Authenticated | Role-scoped EMS chatbot |
| GET | `/ai/insights` | Authenticated | Role-scoped AI workforce/personal insight |

## Email delivery behavior

Announcement and holiday creation responses include notification/email delivery counts and whether SMTP is configured. Password reset intentionally returns a generic response for valid email submissions to avoid account enumeration. Delivery outcomes are written to `EmailLog`; actual delivery depends on valid SMTP credentials, sender verification and provider network policy.

## Admin Employee Analytics

All endpoints below require a valid bearer token and an Admin role. Authorization is checked in the controller; hiding the frontend route is not the security boundary.

- `GET /api/analytics/admin/comparison` — accepts `range=7d|30d|month|quarter|year|custom`, `startDate`, `endDate`, `department`, `designation`, `employmentType`, `status`, and comma-separated `employeeIds`.
- `GET /api/analytics/admin/employees/:employeeId` — individual 12-month analytics, profile, attendance, approved leave, payroll, salary structure/history, performance reviews and available goal/overtime data.
- `GET /api/analytics/admin/team-average?employeeId=:id` — department team averages over the recent 30-day period.
- `GET /api/analytics/admin/employees/:employeeId/notes` — list up to 100 persistent admin notes.
- `POST /api/analytics/admin/employees/:employeeId/notes` — create an append-only note; JSON body `{ "body": "..." }`, 1–4000 characters.

Employee analytics does not expose private salary or other employees' information to Employee-role sessions. Missing data sources (productivity KPIs, tasks/projects, login activity) are reported as unavailable rather than generated.
