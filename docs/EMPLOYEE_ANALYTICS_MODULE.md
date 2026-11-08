# Employee Analytics

The admin-only Employee Analytics page is available at `/employee-analytics`. Both route visibility and API authorization are enforced; all sensitive queries verify the authenticated role on the server.

## Employee Comparison

- Date presets: last 7 days, last 30 days, this month, this quarter, this year and custom start/end dates.
- Filters: department, designation, employment type, employee status and multiple employee selection.
- Metrics: employee count, active count, attendance, working hours, finalized-payroll overtime, approved leave and submitted performance ratings.
- Visualizations: attendance comparison, daily trend, attendance status distribution (present/late/absent/partial/approved leave), attendance-versus-performance scatter, working-hours comparison, leave-by-category and leave-by-employee.
- Table: employee ID (Mongo employee ID), department, designation, employment type, status, attendance, leave, working hours, overtime, rating and current gross salary.
- Table tools: search, sorting, pagination, CSV export and Excel-compatible SpreadsheetML `.xls` export. SVG-based charts expose PNG and SVG export actions.

## Individual Employee Analytics

- Profile photo, name, email, Mongo employee ID, department, designation, join date, reporting manager where configured and employment status.
- Attendance percentage uses weighted credit for full, three-quarter and half days; absences and short days receive no credit.
- Leave days are clipped to the selected IST period and counted against configured weekly offs and company holidays; monthly history allocates workdays across month boundaries.
- Attendance heatmap includes saved attendance and approved leave days.
- Monthly attendance, leave and published payroll trends; current leave balance; approved leave distribution; performance reviews and goal-status counts.
- Current salary structure (basic, HRA, allowances, recurring deductions and gross) and saved salary progression; latest published payslip deductions are shown separately from current gross salary.
- Overtime is shown only when saved payroll snapshots contain it.
- Team-average and another-employee comparisons.
- Persistent Admin notes are stored in MongoDB and logged to `HRAuditEvent`; notes are admin-only and append-only in this UI.
- Individual report uses browser Print/Save PDF, with salary visible only to Admin. This is not a server-generated PDF attachment. SVG-based charts can be downloaded as PNG or SVG.

## Data availability limits

- Productivity score: unavailable because no productivity KPI model exists.
- Task/project contribution: unavailable because no task/project module exists.
- Login frequency/activity heatmap: unavailable because no login/activity event model exists.
- Radar/skill KPI chart: unavailable because reviews do not store comparable skill/KPI dimension scores.
- Expected scheduled hours: not inferred from incomplete attendance rows; no artificial expected-hour baseline is created.

All missing data is displayed as N/A or an unavailable state rather than fabricated.
