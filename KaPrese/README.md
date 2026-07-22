# KaPRESE — KK Profiling System (standalone website)

A real, standalone website version of the KK Profiling System for the
Municipality of Presentacion. Built with React + Vite + Tailwind, using
Supabase as the database and Netlify for hosting.

## 1. Create your Supabase project

1. Go to https://supabase.com and sign up / log in (free tier is enough).
2. Click **New project**. Pick any name/region, set a database password
   (save it somewhere), and wait ~2 minutes for it to finish provisioning.
3. In the left sidebar, go to **SQL Editor** → **New query**.
4. Open `supabase-schema.sql` from this folder, copy all of it, paste it
   into the editor, and click **Run**. This creates the one table the app
   needs (`kv_store`) and sets permissions so the site can read/write it.
5. Go to **Project Settings** (gear icon) → **API**. You'll need two
   values from this page in step 3 below:
   - **Project URL**
   - **anon public** key (NOT the `service_role` key — never put that one
     in a website)

## 2. Get the code running on your computer

You'll need [Node.js](https://nodejs.org) installed (version 18 or newer).

1. Unzip this project folder and open it in VS Code.
2. Open a terminal in VS Code (Terminal → New Terminal) and run:
   ```
   npm install
   ```
3. Copy `.env.example` to a new file named `.env` in the same folder:
   ```
   cp .env.example .env
   ```
   (On Windows, just duplicate the file and rename it.)
4. Open `.env` and paste in your Supabase values from step 1.5:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-long-anon-key
   ```
5. Run the site locally to test it:
   ```
   npm run dev
   ```
   Open the URL it prints (usually http://localhost:5173). You should see
   the KaPRESE front page with your three logos. Try registering as a
   barangay, logging in as admin (default passcode `LYDC2026`, change it
   right away under Settings), and adding a member — then check your
   Supabase table (Table Editor → kv_store) to confirm the data landed
   there.

## 3. Put the code on GitHub (needed for Netlify)

1. Create a new empty repository on GitHub (e.g. `kaprese-website`).
2. In your project folder:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/kaprese-website.git
   git push -u origin main
   ```
   Your `.env` file will NOT be pushed (it's in `.gitignore`) — that's
   intentional, so your Supabase key doesn't end up public on GitHub. You'll
   enter it into Netlify directly instead.

## 4. Deploy on Netlify

1. Go to https://netlify.com and sign up / log in (free tier is enough).
2. Click **Add new site** → **Import an existing project** → connect your
   GitHub account → pick the `kaprese-website` repo.
3. Netlify should auto-detect the build settings from `netlify.toml`
   (build command `npm run build`, publish folder `dist`). Leave them as
   is.
4. Before clicking Deploy, open **Add environment variables** and add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **Deploy site**. Wait 1–2 minutes for the build to finish.
6. Netlify gives you a free URL like `random-name-123.netlify.app`. You can
   rename it (Site configuration → Change site name) or attach a custom
   domain you own (Site configuration → Domain management).

Your site is now live and public — share the link with SK officers and
LYDC staff.

## Updating the site later

Any time you want to change something:
1. Edit the code (e.g. `src/App.jsx`) and test with `npm run dev`.
2. `git add . && git commit -m "describe your change" && git push`
3. Netlify automatically rebuilds and redeploys within a minute or two.

## If data still isn't saving

Check these in order:

1. **Is `.env` (locally) or the Netlify environment variables (in production)
   actually set?** Missing or wrong `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` is the most common cause. Open the browser
   console (F12) — if these are wrong you'll see a "Missing Supabase env
   vars" error there.
2. **Was `supabase-schema.sql` actually run** against your Supabase project?
   Table Editor → you should see a `kv_store` table with rows for
   `kk-members-v1`, `kk-sk-officials-v1`, and `kk-auth-config-v1`.
3. **A yellow banner in the app** ("Could not connect to the database…")
   means the site can't reach Supabase at all — check 1 and 2 above.
4. **A red banner** ("Could not save…") means the site reached Supabase but
   the specific write failed or hit a conflicting update — try again; the
   app now automatically retries a few times against the latest data before
   showing this.

## Important security note

This app's "login" is just a shared passcode stored in the database, not
real user accounts. The Supabase anon key you put in Netlify is public
(anyone can see it if they inspect the site), and the database rules
in `supabase-schema.sql` let anyone with that key read/write the table
directly, bypassing the passcode screen entirely. That matches how the
original Claude Artifact worked, but it means:

- Don't put anything truly sensitive in this system.
- Change the default admin passcode (`LYDC2026`) immediately.
- If you eventually need real security (e.g. only real logged-in staff can
  write data), that requires adding Supabase Auth and rewriting the
  database policies to check `auth.uid()` instead of allowing `anon` —
  ask for help with that step if/when you need it.

## Project structure

```
kaprese-website/
  index.html            entry HTML
  supabase-schema.sql   run once in Supabase SQL Editor
  src/
    main.jsx            React entry point
    App.jsx             the whole app (all screens/components)
    storage.js           Supabase-backed replacement for the old
                         Claude-Artifact window.storage API
    supabaseClient.js    creates the Supabase client from your .env
    index.css           Tailwind entry point
```
