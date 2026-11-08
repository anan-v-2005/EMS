# EMS Audit & Implementation Status

## Completed in this pass

- Audited the supplied project structure, frontend/backend architecture, models, controllers, routes, analytics, AI chatbot, notifications, Inngest workflows, and profile flows.
- Preserved the existing React/Vite UI structure and styling; photo support reuses the existing avatar areas rather than introducing a new page/layout.
- Fixed multipart handling so existing `FormData` employee/profile requests are parsed correctly and file uploads can be handled with Multer.
- Added Cloudinary-backed employee profile photos with MongoDB storing `profilePhotoUrl` and `profilePhotoPublicId` only.
- Added self-service photo upload/delete endpoints and Admin employee photo upload/delete endpoints.
- Added optional photo handling to Admin employee create/update API requests.
- Added photo display to employee cards and profile/avatar views.
- Added reusable SMTP/Nodemailer configuration with environment-driven host, port, security, credentials, and sender.
- Added reusable email templates and non-blocking email notifications for employee creation/update, leave status changes, and payslip creation.
- Hardened existing Inngest email notifications so missing/broken SMTP configuration does not break the workflow transaction.
- Replaced the deprecated Mongoose `{ new: true }` option with `{ returnDocument: "after" }` where `findOneAndUpdate`/`findOneAndReplace` behavior requires the updated document.
- Improved Admin analytics attendance calculation by using an employee/day lookup map instead of repeatedly scanning the full attendance array inside each day loop.
- Corrected the Admin daily attendance denominator to exclude employees who had not joined yet and to respect the workday/holiday calculation.
- Updated Gemini integration to default to the currently documented `gemini-3.8-flash` model and removed deprecated sampling-temperature configuration from the requests.
- Kept deterministic Gemini/Analytics fallbacks so quota or provider failures do not make the EMS unusable.
- Added `server/.env.example` with all new Cloudinary and SMTP variables.
- Removed the uploaded production `server/.env` from the deliverable.

## Photo API

- `POST /api/profile/photo` — employee uploads/updates own photo; multipart field: `photo`.
- `DELETE /api/profile/photo` — employee deletes own photo.
- `POST /api/employees/:id/photo` — Admin uploads/updates an employee photo.
- `DELETE /api/employees/:id/photo` — Admin deletes an employee photo.
- `POST /api/employees` and `PUT /api/employees/:id` accept an optional `photo` multipart field.

Image validation is limited to JPG, PNG, WEBP, and GIF and 5 MB per upload.

## Validation performed in this environment

- All backend JavaScript files pass Node `--check` syntax validation.
- Search confirms no remaining `{ new: true }` update option in the backend.
- The supplied archive does not include dependency installation usable by this Linux validation environment; `npm install`/`npm ci` timed out before dependencies became available, so a real `npm run lint` / Vite production build could not be executed here.
- Frontend changes were therefore checked by source inspection and backend syntax validation; run `npm install`, `npm run lint`, and `npm run build` locally before deployment.

## Production security

- Never commit `server/.env`.
- Rotate any credentials that were exposed in the original uploaded archive before production use.
- Never expose `CLOUDINARY_API_SECRET`, SMTP password, MongoDB credentials, JWT secret, or Gemini API key in frontend code.

## Attendance and insight fixes added in this pass

- Replaced check-in-relative auto-checkout timing with an Inngest daily schedule at 8:00 PM Asia/Kolkata. Open attendance records are checked out using the fixed 8:00 PM timestamp, working hours/day type are recalculated, and a clear auto-checkout email is sent.
- Backend attendance check-in/check-out now rejects employees whose approved leave overlaps today's India-local date with the required message.
- Employee login rejects missing, deleted, or inactive employee records with the explicit deactivation message.
- Notification and AI assistant panels now close on outside pointer clicks while preserving their existing close buttons and styling.
- AI insight content is vertically scrollable; the Admin insight uses the full available width and a larger scroll area.
- Added indexes for attendance date lookups and approved-leave date checks.
- Updated README with full local setup, environment configuration, seed-admin instructions, SMTP setup, and local/production Inngest scheduling instructions.
- Removed the uploaded `server/.env` from the output so secrets are not shipped in the project archive.

Validation for this pass: all backend `.js` files passed `node --check`. Frontend lint/build and live MongoDB, SMTP, and Inngest integration tests were not run in this environment; follow the README validation steps with configured services before production deployment.


## Follow-up audit pass (2026-10-25)

### Confirmed defects found and corrected in this pass

- `server/controller/attendanceController.js`: Sunday check-in was not blocked. New attendance sessions now reject Sunday using the `Asia/Kolkata` weekday, with the required message. Existing sessions remain closable, so a checkout crossing midnight is not blocked solely because the new local day is Sunday.
- `server/controller/attendanceController.js`: approved-leave checks ran before determining whether the request was a check-in or checkout. This could prevent an employee from closing an existing session if leave was approved after the attendance record existed. The approved-leave check now applies only when starting a new session. This preserves the record and avoids silently overwriting it. A dedicated HR reconciliation workflow for this conflict is still not implemented.
- `server/controller/attendanceController.js`: repeated checkout returned HTTP success with an already completed record. It now returns HTTP 409 with a clear message. Invalid/future check-in timestamps are rejected before checkout calculation.
- `server/controller/attendanceController.js`: inactive employment status is now rejected for new attendance actions in addition to the existing deleted-account check.
- `server/services/payrollCalculator.js`: provident-fund deduction was hardcoded at 12% of basic salary. It is now zero unless an explicit `pfRate` or `pfAmount` is supplied, avoiding an unverified statutory assumption. Callers must pass the organisation's verified policy if this deduction is required.
- `server/tests/payrollCalculator.test.js`: updated the default PF expectation and added a test proving PF is only applied when configured.

### Validation performed in this pass

- `node --check server/controller/attendanceController.js`: passed.
- `node --check server/services/payrollCalculator.js`: passed.
- `npm test` from `server/`: passed, 6 tests / 6 passed.
- Frontend lint/build, database-backed attendance integration tests, concurrency tests, and live Inngest/Gemini/SMTP checks were not run in this environment.

### Remaining high-priority limitations

- Attendance uniqueness currently relies on schema indexes and `findOne` followed by `create`; concurrent check-ins can still race if the database indexes are not successfully built. Verify index creation against existing data and handle duplicate-key errors explicitly before production.
- The existing attendance model supports only one record per employee/date; multiple shifts/sessions are not supported by this schema.
- Existing scheduled auto-checkout uses a fixed 6:00 PM time and needs organisation/shift policy configuration before it can be considered suitable for different shifts.
- The current payroll/payslip controller accepts admin-supplied salary values and is not yet a complete draft-review-approve-finalise payroll-run workflow. Do not describe automatic payroll finalisation as implemented.
- Attendance/leave conflicts are not yet recorded in a dedicated reconciliation queue, and finalised-payroll locking is not fully integrated into attendance correction flows.
- Current workday payroll logic treats Saturday and Sunday as non-working days; this is an assumption that must be replaced by configured work schedules before use by organisations with different calendars.
- Annual leave reset, Gemini real-data query grounding, CORS deployment, and mobile viewport acceptance tests still require separate end-to-end verification.


## Functional correction pass (2026-10-31)

### Implemented in the supplied project

- Attendance review no longer closes historical open sessions merely because the Admin opened/refreshed the attendance list. This keeps the explicit **Run auto-checkout** action meaningful. The manual sweep uses the configured `attendancePolicy.SHIFT_END`, processes eligible prior-day sessions and same-day sessions only after shift end, and writes an audit entry for each successful close. The response reports both checked and closed counts with a clear no-op explanation.
- Checkout corrections now validate the timestamp and reject checkout times earlier than check-in. Attendance list refresh and audit requests include cache-busting request parameters. Audit rows show action, date, actor (or System), reason, and an explicit empty-state message.
- Salary structure employee selection now pre-populates Basic salary from the employee salary mirror immediately, then loads the active salary structure to populate Basic, HRA and Allowances without changing Leave Balance.
- Admin Analytics now renders department distribution as a pie/donut visualization, displays the most recent five months for workforce attendance and net payroll, displays leave requests in reverse chronological month order, and reports latest month-over-month headcount growth.
- Admin announcements and holidays can be filtered by India-local month and display at most five entries per section. The holiday year is reloaded when the selected month changes.
- Announcement/holiday notification delivery now tolerates invalid/missing employee email addresses and notification-write failures without turning an already-created announcement/holiday into a false creation failure. Responses include delivery counts and whether SMTP is configured.
- Admin Profile 360 now loads real account details (email, role, creation/update dates and password setup state) and current workforce metrics rather than displaying a generic placeholder.
- Sidebar logout now asks “Are you sure you want to logout?” and only logs out after confirmation; cancel closes the modal. This applies to both roles.
- AI Insight panels have a substantially larger visible area with vertical scrolling. The Insight request uses the server cache instead of forcing a new Gemini request every time.
- AI chatbot work is reduced through a short-lived per-account context cache, short-lived repeated-question response cache, and a maximum of two model attempts rather than up to six. Holiday/announcement context is loaded only for related questions.
- Added a safe `server/.env.example` documenting SMTP, reset-link origin, Gemini and Cloudinary variables. No `.env` secrets are included in this deliverable.

### Validation performed in this environment

- All backend JavaScript files passed `node --check`.
- Backend test suite passed: **61 tests, 0 failures**.
- Frontend ESLint passed with **0 errors and 0 warnings**.
- All 44 frontend JavaScript/JSX source files parsed successfully with Babel's parser.
- A Vite production build could not be completed in this Linux validation environment because the uploaded `node_modules` contains Windows Rollup binaries but not the Linux optional package `@rollup/rollup-linux-x64-gnu`; installing that optional package timed out. Run `npm ci` in `client/` on the deployment/build machine, then `npm run lint` and `npm run build`.
- Live MongoDB, SMTP delivery, password-reset inbox receipt, Inngest schedule execution, Gemini latency, and browser-based end-to-end workflows were not testable without the user's configured service credentials and runtime. These remain required pre-deployment checks.
