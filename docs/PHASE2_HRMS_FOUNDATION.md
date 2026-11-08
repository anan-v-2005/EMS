# Phase 2 HRMS API foundation

This patch adds authenticated HRMS APIs while retaining the existing portal UI.

## Added data domains
- Employee document metadata and admin verification (`HRDocument`). File bytes are not uploaded by these endpoints; `fileUrl` must be a trusted HTTPS URL from the configured storage provider.
- Performance reviews and goals (`PerformanceReview`). Admin creates/updates reviews; employees can read their own reviews.
- Centralized approval requests (`ApprovalRequest`). Employees can submit requests; admins can review pending requests.
- Employee lifecycle events (`HRLifecycleEvent`). Admin-managed timeline; employees can read their own timeline.
- Append-only application audit events (`HRAuditEvent`). Admin read access; records are written by the new HRMS actions.

## API routes
All routes require a valid Bearer JWT under `/api/hrms`.

| Method | Route | Access |
|---|---|---|
| GET | `/documents` | Admin all / employee own |
| POST | `/documents` | Admin |
| PATCH | `/documents/:id/verification` | Admin |
| GET | `/performance-reviews` | Admin all / employee own |
| POST | `/performance-reviews` | Admin |
| GET | `/approvals` | Admin all / employee own |
| POST | `/approvals` | Authenticated user; employee scoped to own profile |
| PATCH | `/approvals/:id/review` | Admin |
| GET | `/lifecycle/:employeeId` | Admin / matching employee |
| POST | `/lifecycle` | Admin |
| GET | `/audit` | Admin |

## Important limitations / next implementation work
- These APIs are a foundation, not a complete HRMS UI. Existing client pages have not yet been wired to these endpoints.
- Document upload integration must be connected to the project's configured Cloudinary/storage service; do not accept arbitrary public URLs from untrusted clients in production.
- Approval decisions currently record the decision but do not automatically execute the underlying leave/attendance/profile operation. Each workflow needs a transactional domain-specific handler before production use.
- Performance review notifications, manager hierarchy, employee acknowledgement UI, and review-cycle scheduling remain to be implemented.
- Lifecycle events are timeline records; they do not independently change employment status, payroll, or access. Those changes require validated, audited domain workflows.
- Audit writes are best-effort in this initial layer. Critical payroll and attendance mutations should use transactional audit writes and tamper-evident retention controls.
- Run the existing server test suite and complete integration tests with configured MongoDB, mail, Cloudinary, Gemini and Inngest credentials before deployment.
