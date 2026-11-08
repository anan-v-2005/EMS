# Payslip & reliability upgrade (v2)

## Bugs fixed
| Area | Problem | Fix |
|---|---|---|
| Absence → leave | `convertAbsenceToLeave` used `LeaveApplication`, `reserveLeaveBalance`, `releaseLeaveBalance` without importing them → always crashed | Imports added; also refuses when an approved leave already covers the day |
| AI assistant | Fallback answer referenced a `const` declared inside `try` from `catch` → fallback itself returned 500 | Variable hoisted |
| Payroll privacy | Employees could list/open **draft** payroll snapshots | Employees see finalized only; drafts return 404 |
| Payroll accuracy | Open (not yet checked-out) sessions and not-yet-reached days of the current month counted as LOP | Open sessions counted present + flagged; future days are "pending"; month must be over unless "generate early" is ticked |
| Payroll accuracy | Mid-month joiners were paid the full month | Days before the join date are deducted |
| Payroll accuracy | Typed overtime rate was silently multiplied by 1.5 | Typed rate is used as-is; multiplier only applies to the derived rate |
| Payroll accuracy | Salary lookup required `isActive`, so back-dated payroll lost history after a revision | Uses the structure in force on each day (mid-month revisions pro-rated) |
| Payroll accuracy | Saturday "off" for payroll/leave but only Sunday blocked at check-in; OPTIONAL holidays treated as company-wide off days | One configurable weekly-off policy; optional holidays are not days off |
| Holidays | Built-in 2026 holidays had fake IDs (edit/delete → 500) and were invisible to payroll/leave | Persisted on first load |
| Salary structure | Client-supplied `fixedMonthlyGross` could disagree with components | Gross is always basic + HRA + allowances |
| Payslip UI | `$` currency on an INR system; `"undefined "` shown when employee missing; full-page reload on download; invalid IDs caused 500 | ₹ everywhere, safe names, router navigation, 404 |
| Misc | Missing `server/.env.example` referenced by README; leftover `{ new: true }` options | Added; replaced with `returnDocument: "after"` |

## New
Unified payslip workflow (draft/finalize/reopen/delete), live preview, bulk generate/finalize, manual mode, other earnings/deductions,
payroll settings (weekly offs, pay-days basis, overtime, late marks, optional PF/ESI/professional tax), richer printable payslip, audit history,
payslip numbers, employee dropdowns instead of pasted IDs, `npm run migrate:payroll`.

## Compatibility
- `Payslip` keeps `basicSalary + allowances − deductions = netSalary`, so dashboards, analytics, AI and search work unchanged. Documents created before this
  upgrade have no `status` and are treated as finalized. Drafts are excluded from all of those consumers.
- UI: same layout, colours, buttons and modal style; the Generate button/dialog and payslip table are the same components, extended.

## Verified here
- 35 automated tests (engine rules, settings validation, data layer against fake models).
- TypeScript scan of all server files for undefined identifiers: clean (it also caught the two pre-existing crashes above).
- Whole client bundled with esbuild (all imports resolve, JSX valid); unused-variable scan of changed client files: clean.

## NOT verified here (needs your machine)
No network was available, so dependencies were not installed. Please run: `npm install && npm test` (server), `npm run lint && npm run build` (client),
then try the flow against a **staging** database: Settings → Generate → review warnings → Finalize → view as the employee.
Mongoose queries/updates, the browser UI rendering, email/Inngest were not exercised against live services.
Statutory values (PF/ESI/PT slabs, TDS) are administrator-configured and must be verified by a qualified person before real payroll use.

## Known limits
Attendance analytics/dashboard widgets still assume Sat+Sun for their own day counts. No sandwich-leave rule, comp-off for work on off days, arrears,
or automatic TDS. PDF is browser print-to-PDF.
