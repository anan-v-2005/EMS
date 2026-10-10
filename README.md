# Employee Management System (EMS)

A React + Vite employee/admin management application with an Express API, MongoDB/Mongoose, JWT role-based access, attendance, leave, holidays, payslips, analytics, Gemini-assisted insights/chat, Inngest workflows, SMTP email, and Cloudinary employee photos.

## Requirements

- Node.js 20 or newer and npm
- MongoDB local instance or MongoDB Atlas database
- SMTP credentials for email delivery (optional for login/basic local browsing, required for actual email delivery)
- Inngest account for deployed scheduled workflows; Inngest Dev Server for local scheduled-workflow testing

## 1. Configure the backend

```bash
cd server
npm install
```

Copy `server/.env.example` to `server/.env` and set at least:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/ems
JWT_SECRET=replace-with-a-long-random-secret
PORT=4000
CLIENT_URL=http://localhost:5173
ADMIN_EMAIL=admin@example.com
```

For a hosted database, replace `MONGODB_URI` with the MongoDB Atlas connection string and allow your development/deployment environment to connect in Atlas Network Access. Do not commit `.env` files or use the example JWT secret in production.

### Create the initial admin account

The seed script creates an admin using `ADMIN_EMAIL` and the temporary password `admin123`:

```bash
npm run seed
```

Change the password immediately after first login. Employee accounts are created through the existing Admin employee-management flow.

### Start the backend

```bash
npm run dev
```

The API is available at `http://localhost:4000`; `GET /` should return `Server is running`.

## 2. Configure and start the frontend

In a second terminal:

```bash
cd client
npm install
```

Copy `client/.env.example` to `client/.env` and set `VITE_BASE_URL=http://localhost:4000` for local development.

```bash
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

## 3. Scheduled attendance and reminder workflows

The backend exposes Inngest at `/api/inngest`. For local testing of scheduled jobs, run the backend and then start the Inngest Dev Server in another terminal:

```bash
npx inngest-cli@latest dev -u http://localhost:4000/api/inngest
```

Open the local Inngest dashboard and confirm the functions are registered. In production, configure the Inngest app to sync with your deployed backend's `/api/inngest` endpoint and set the Inngest environment variables if required by your deployment.

- **Auto-checkout:** runs daily at 8:00 PM `Asia/Kolkata` and sets any still-open attendance record's checkout timestamp to exactly 8:00 PM IST, computes working hours/day type, and sends the employee an email.
- **Attendance reminder:** runs daily at 11:30 AM `Asia/Kolkata` and emails active employees who have not checked in and are not on approved leave that day.
- **Leave review reminder:** reminds the Admin about pending leave applications after 24 hours.

Scheduled execution requires the Inngest Dev Server locally or a correctly synced Inngest production app. A cron trigger is scheduled for 8:00 PM; actual job execution and email delivery depend on the scheduler and SMTP provider being available. Core attendance actions also enforce approved-leave restrictions in the backend.

## 4. Email setup

Set the SMTP variables in `server/.env`. Example for Brevo SMTP:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SENDER_EMAIL=no-reply@your-verified-domain.example
```

Use credentials from your SMTP provider and a verified sender address. Email delivery failures are logged and do not undo the underlying attendance action. The app cannot send real email until valid SMTP credentials and sender configuration are supplied.

## 5. Optional integrations

- **Gemini:** configure `GEMINI_API_KEY` and, if needed, `GEMINI_MODEL`.
- **Cloudinary photos:** configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Never expose the API secret in frontend configuration.
- **Vercel:** deploy frontend and backend separately according to their existing Vercel configuration files; configure environment variables in each deployment. Ensure the Inngest production app is synced to the deployed backend endpoint.

## Implemented attendance and UX safeguards

- Approved leave overlapping today's India-local date blocks both check-in and check-out with the message: `You are on leave today and cannot mark attendance.`
- Deleted/inactive employees are rejected during backend login and attendance authorization.
- Notification dropdown and AI assistant close when the user clicks outside them; existing close controls remain.
- AI insight text areas scroll vertically without changing the existing card design.
- Attendance date/employee and leave date/status indexes support common attendance and approved-leave lookups.

## Validation

```bash
cd server
node --check server.js
```

Frontend quality checks:

```bash
cd client
npm run lint
npm run build
```

For production, test the full login, attendance, leave, scheduled Inngest execution, and email flows with your actual environment configuration before inviting users.
