# My Space — Personal Life Management PWA

A minimal personal space for daily journaling, habits, tasks, ideas, and a private library. It uses React, TypeScript, Vite, Supabase, Google OAuth, RLS, and a PWA service worker.

## Setup

1. Create a Supabase project and enable the Google provider under **Authentication → Providers**.
2. In Google Cloud, create OAuth credentials and add the Supabase callback URL shown in the provider configuration.
3. Add your local and production app URLs under **Authentication → URL Configuration** in Supabase.
4. Copy `.env.example` to `.env`, then fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never use a service-role key in the frontend.
5. Run the SQL in `supabase/migrations/20260811000000_initial_schema.sql` using the Supabase SQL editor, or apply it with the Supabase CLI.

```bash
npm install
npm run dev
```

Use `npm run build` to make a production build. The PWA manifest and service worker are generated at build time; install the app from the browser's install action.

## Project structure

`src/features` contains screen-level feature modules; `src/lib` contains Supabase/date utilities; `supabase/migrations` contains the schema, indexes, trigger, and RLS policies.

## Security & data behavior

Every data table defaults `user_id` to `auth.uid()` and has RLS policies requiring the current user. UI deletions are soft deletes via `deleted_at`; no DELETE policy is created. Dates use local calendar strings (`YYYY-MM-DD`) to avoid UTC date shifts.
