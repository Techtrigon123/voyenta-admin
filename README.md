# Voyenta Admin

The admin portal for Voyenta. It's a separate Next.js app that shares the Voyenta app's Supabase database. Run it locally on port 3001, or deploy it to its own address such as `admin.voyenta.com`.

## Setup

1. **Database.** In the Supabase SQL Editor, run `checkin-app/supabase/migrations/0006_admin_portal.sql`. Migrations 0004 and 0005 must already be in place.
2. **Environment.** Copy `.env.example` to `.env.local` and fill it in. `ADMIN_SESSION_SECRET` must be different from the Voyenta app's `JWT_SECRET`.
3. **Install and run:**
   ```
   npm install
   npm run dev          # http://localhost:3001
   ```
4. **First master admin:**
   ```
   npm run create-master -- you@example.com "Your Name"
   ```
   The script prints a one-time temporary password. Sign in at `/login`, scan the QR code with an authenticator app, then choose your own password.

**Recovery.** If a master loses their phone or password, run `npm run create-master -- --reset you@example.com`.

## Roles

| | Master admin | Sub admin |
|---|---|---|
| Agents | Everything: view, verify, notes, reset links, unlock, suspend, services, plans, change email, delete, export | View, verify, internal notes, password-reset links; unlock accounts only if a master allows it |
| Plan payments | Approve, reject, refund | View proofs and mark them "checked" |
| Support & contact | Yes | Yes |
| Reports | Activity and revenue | Activity only |
| Admins, audit log, settings | Yes | Never |

Rules that always apply:

- **Server checks:** the server checks permissions on every request, not just in the screens. Sub-admins can never be granted master-only permissions.
- **2-step verification:** every admin must use it. It's set up at first sign-in.
- **Audit log:** every admin action is recorded, and nobody can edit or delete an entry.
- **Document privacy:** admins see document counts, never their contents.

## Deploying

Deploy as a separate Vercel project with the same environment variables, using its own domain. You can also restrict it to your office IP addresses or put Vercel password protection on it. The app already sends `noindex` and no-framing headers.
