# Anime World PK — Supabase Edition

Node.js/Express website using Supabase PostgreSQL for catalog metadata and Supabase Storage for posters/videos. Large video files are uploaded directly from the admin browser to Supabase using signed upload URLs, so the Node host does not need persistent local storage.

## Local setup
1. Create a Supabase project.
2. Run `supabase-schema.sql` in Supabase SQL Editor.
3. Copy `.env.example` to `.env` and fill in:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose this in browser code)
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
4. Run `npm install` then `npm start`.
5. Open `/admin.login`.

## Deployment
This app is suitable for a Node.js web service such as Render Free. Render's free filesystem is ephemeral, so this version intentionally does not use local `data/` or `uploads/` for persistent content. Supabase holds the persistent data and media.

## Important free-tier limit
Supabase Free currently includes 1 GB Storage and a 50 MB maximum file size. This means this architecture is technically ready for Supabase, but videos larger than 50 MB cannot be uploaded on the Supabase Free plan. Free-plan egress is 10 GB/month (5 GB cached + 5 GB uncached). For a real video library, you will need smaller files/strict usage limits or a different storage provider/paid plan.

Only upload/distribute content you are legally authorized to use.
