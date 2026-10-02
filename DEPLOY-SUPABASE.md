# Anime World PK — $0 deployment checklist

## 1) Create Supabase project
- Create a free Supabase project.
- Open **SQL Editor** and run `supabase-schema.sql` from this ZIP.
- The script creates the `anime` and `episodes` tables and the public `anime-media` bucket.

## 2) Get Supabase keys
In **Project Settings -> API** copy:
- Project URL -> `SUPABASE_URL`
- Publishable/anon key -> `SUPABASE_ANON_KEY`
- Service role key -> `SUPABASE_SERVICE_ROLE_KEY`

Keep the service-role key secret. It must only be a server environment variable.

## 3) Put the project on GitHub
Create a new GitHub repository and upload the project files. Do NOT upload `.env` or real secrets.

## 4) Deploy Node.js app
Use a free Node.js Web Service such as Render.
- Connect the GitHub repository.
- Build command: `npm install`
- Start command: `npm start`
- Plan: Free

Add environment variables:
- `NODE_ENV=production`
- `ADMIN_PASSWORD=<your strong password>`
- `SESSION_SECRET=<long random secret>`
- `SUPABASE_URL=<your project URL>`
- `SUPABASE_ANON_KEY=<your anon/publishable key>`
- `SUPABASE_SERVICE_ROLE_KEY=<your service role key>`
- `SUPABASE_STORAGE_BUCKET=anime-media`

The app already binds to `0.0.0.0` and the Render `PORT` variable.

## 5) Test
Open the Render URL and then `/admin.login`.
- Login with your `ADMIN_PASSWORD`.
- Create an anime with an optional poster.
- Upload a video <= 50 MB.
- Open the anime page and play the episode.

## 6) Free-plan reality
Supabase Free currently includes 1 GB Storage and a 50 MB maximum file size. It also includes 10 GB/month of egress (5 GB cached + 5 GB uncached). A video site can exceed these limits quickly, so this is a free/testing/hobby setup rather than unlimited video hosting.

Render Free web services spin down after 15 minutes without traffic and have an ephemeral filesystem. This project avoids storing persistent data on the Render disk and keeps catalog/media in Supabase.

Only upload/distribute content you are legally authorized to use.
