# Studify authentication

## Email-free signup

Registration accepts an email address as the login identifier but **does not send an email**. A server route creates the Auth user with `email_confirm: true`, then the browser signs in with the supplied password. No confirmation link, welcome message, farewell message, resend or password recovery email is offered. No Resend or SMTP site variables are required for these app flows.

The Auth email is **not verified as owned by the registrant**. Someone could reserve another person's address. If the password is lost there is no self-service recovery path; an account with existing notes may become inaccessible. Do not treat the stored address as proof of identity. Supabase-wide Auth notification emails, if enabled in the project dashboard, are outside the application's control and must be disabled there to enforce an absolute no-email policy across the project.

The public registration route checks origin, email format and password policy, uses the server-only Admin API, and has best-effort per-worker throttling. Configure platform-wide bot protection and rate limiting before public scale. The admin secret must never enter client code or source control.

## Data scope

At inspection, public schema contains no application tables. Profile data is the Auth user. Notes/folders live in browser localStorage scoped to Auth user ID, not in Supabase. Deletion hard-deletes Auth and purges this browser's scoped and legacy app data. New accounts do not inherit unowned legacy notes. Other offline browsers, exports, provider logs and backups cannot be erased by browser code. Do not promise universal erasure. Cloud note persistence and multi-device erasure require a separate data migration.

Account existence is deliberately disclosed as requested. Lookup runs only on the server via Admin API, returns one boolean, never user records. Per-worker burst protection is best-effort; configure edge-wide rate limiting before scaling.

## Checks

`node scripts/test-account-deletion.mjs`: authorization, confirmation and hard-delete checks with mocked Auth.
`node scripts/test-auth-flows.mjs`: checks registration, duplicate handling, login and deletion with mocked Auth and verifies no email-sending API is called. No production accounts are touched.
