# EMS/HRMS bug-fix update — 2 November 2026

## Changes made from the user-reported test findings

1. **Employee archive/restore status:** archiving now stores the employee's pre-archive `employmentStatus`; restore returns that status instead of unconditionally activating every restored employee. Older archived records without the new field retain the previous fallback (`ACTIVE`) because their prior status cannot be reconstructed from the stored record.
2. **HRMS Workspace → Lifecycle:** lifecycle event rendering now safely handles legacy/malformed events with a missing `eventType` instead of throwing while rendering the timeline. The existing employee selection and timeline API flow is retained.
3. **Employee Analytics → Individual Employee → Team Average:** fixed the reported `ReferenceError: teamEnd is not defined`. The endpoint now defines one inclusive IST end boundary, fetches weekly-off and holiday policy data, and selects the leave date/type fields required by the leave-day calculator.
4. **Employee Analytics → All Employees → Headcount Growth:** added 5-month, 1-year and all-available-history selectors. The API generates the selected month range; all-history is bounded to 240 months (20 years) to prevent unbounded analytics queries. The chart uses a clearer labeled bar treatment and only counts saved employee records by joining date.
5. **Individual attendance calendar:** present days are light green and absent days are red; late and approved leave retain separate colors, with a matching legend.
6. **Admin Attendance:** added 7-day, 30-day, 90-day, 1-year and latest-500-record views. The backend validates the period and applies the date filter in the database query.

## Verification performed on this source tree

- Backend JavaScript syntax checks: passed for all source `.js` files.
- Frontend ESLint: passed.
- Backend tests: **83 passed, 0 failed**.
- Frontend production build: **not verified**. The supplied `node_modules` did not contain the platform-specific optional dependency `@rollup/rollup-linux-x64-gnu`; the build stops in Rollup before compiling the app. Run `npm ci` in `client` on the target machine, then `npm run build`.
- MongoDB Atlas, SMTP, Inngest, Cloudinary, Gemini and browser end-to-end behavior were not live-tested in this environment.

## Remaining verification notes

- A blank Lifecycle page cannot be conclusively diagnosed from a screenshot alone. The current source's Lifecycle tab is present and its API route exists; the timeline requires selecting an employee. If the page still renders blank after this update, capture the browser Console stack trace and backend response for `GET /api/hrms/lifecycle/:employeeId`.
- Existing archived employee records created before this patch do not contain their original employment status. Their previous status is not recoverable unless another audit/history record records it.
- Employee Comparison metrics intentionally return N/A when a source metric is unavailable. Attendance percentage is based on recorded attendance entries, not inferred unrecorded working days; treat it as a recorded-attendance rate, not an attendance-vs-scheduled-workday rate.
