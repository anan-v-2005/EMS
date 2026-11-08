# Automated test report

Environment: Node.js v22.16.0, Linux x64.

| Test/check | Result |
|---|---:|
| Backend automated tests | 83 passed / 0 failed |
| Frontend ESLint | Passed |
| Frontend JS/JSX syntax parse | 46 files passed |
| Backend JS syntax scan | Passed |
| Vite production build | Blocked by missing Linux Rollup optional package |

The checks were run against the source extracted from the final ZIP. The Linux Rollup optional package is declared in the client lockfile but absent from the Windows-origin dependency cache used for this run.

Backend suite coverage includes date/timezone helpers, email template escaping and structure, password reset token security, leave allocation/proration, payroll calculation and integration, salary revision logic, security/rate limiting, input validation, employee analytics note authorization and validation, team-average invalid ID handling, attendance-credit weighting, and leave analytics date-overlap/weekly-off/holiday/half-day calculations.

The test suite is not a substitute for MongoDB integration tests, SMTP inbox tests, browser interaction tests or provider-side scheduled-job verification.
