# Phase 1 Reliability Patch — EMS HRMS

## Scope

This patch makes targeted backend reliability corrections while preserving the existing application layout, routes, components, and architecture.

## Changes

1. **Attendance audit coverage**
   - Normal employee check-in now writes a `CHECK_IN` audit event.
   - Normal employee check-out now writes a `CHECK_OUT` audit event.
   - `AttendanceAudit` supports `CHECK_IN`, `CHECK_OUT`, `AUTO_CHECKOUT`, and `CHECKOUT_EDIT`.
   - Check-in/check-out timestamps are stored in dedicated before/after fields where applicable. Existing audit documents remain readable.

2. **Centralized weekly-off policy in analytics**
   - Legacy employee/admin analytics no longer hardcodes Saturday and Sunday as weekly offs.
   - It now reads `weeklyOffDays` from the same payroll settings service used by attendance and payroll.
   - The analytics day iterator now derives weekdays from the IST calendar date, avoiding the previous UTC-midnight weekday shift.
   - Company-wide analytics ignore `OPTIONAL` holidays; optional holidays are not treated as a universal day off.
   - Daily employee summaries also ignore optional holidays as company-wide closures.

3. **Sunday-only default**
   - New/default payroll settings now use `weeklyOffDays: [0]` (Sunday only), so Saturday is a working day by default.
   - Existing saved MongoDB settings override defaults. Review the saved `PayrollSettings` document before deploying this change.

## Existing database setting check

Inspect the organisation settings document:

```javascript
db.payrollsettings.findOne({ key: "default" }, { "data.weeklyOffDays": 1 })
```

If the organisation's intended policy is Sunday-only, update the stored setting explicitly:

```javascript
db.payrollsettings.updateOne(
  { key: "default" },
  { $set: { "data.weeklyOffDays": [0] } }
)
```

Do not run the update if the organisation intentionally observes a different weekly-off schedule. The application cannot inspect the live database from this source ZIP.

## Verification performed in the inspection environment

- All server JavaScript files passed `node --check`.
- 52 dependency-light automated tests passed, including payroll, leave, salary, email-template, validation, and IST weekday tests.
- The complete test suite could not be completed because the inspection environment did not have a usable installed `mongoose` dependency. `npm ci` timed out in this environment; `tests/payrollData.test.js` therefore could not load its Mongoose models.
- Frontend build/lint, MongoDB integration, Inngest execution, email delivery, and deployed behavior remain unverified.

## Modified files

- `server/config/payrollDefaults.js`
- `server/controller/analyticsController.js`
- `server/controller/attendanceController.js`
- `server/models/AttendanceAudit.js`
- `server/services/attendanceSummary.js`
- `server/utils/date.js`
- `server/tests/payrollData.test.js`
- `server/tests/payrollEngine.test.js`
- `server/tests/date.test.js` (new)

## Deployment notes

1. Back up MongoDB before changing the saved weekly-off policy.
2. Install dependencies in the normal development/deployment environment with `npm ci` in `server` and `client`.
3. Review the stored weekly-off setting and update it only if Sunday-only is the approved company policy.
4. Deploy the backend and verify a Saturday check-in, Sunday block, employee check-in/check-out audit entries, and the Admin View Log flow.
5. Run the full test suite and frontend build in an environment with all dependencies installed before production deployment.
