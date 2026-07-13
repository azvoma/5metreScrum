# Connecting the 5 Metre Scrum Database (Supabase)

The site now has a real registration and CV-building system. Until the
database is connected it runs in **demo mode**: everything a player types
into the CV wizard is captured and saved in their own browser, and their
profile page and scout board entry work — but only on their device.
Connecting Supabase (about 10 minutes, free) makes registrations global:
every player who signs up appears on the Scout Board for everyone.

## Step 1 — Create the Supabase project
1. Go to https://supabase.com and sign up (free plan is fine).
2. Click **New project**, name it `5metrescrum`, choose a strong database
   password (save it somewhere), pick the **London (eu-west-2)** region.
3. Wait ~2 minutes for the project to finish provisioning.

## Step 2 — Create the database tables
1. In the left sidebar click **SQL Editor**.
2. Open the file `supabase-schema.sql` (in the root of the site folder),
   copy the whole thing, paste it into the editor, click **Run**.
3. You should see "Success. No rows returned."

## Step 3 — Connect the site
1. In the Supabase sidebar go to **Settings → API**.
2. Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`).
3. Copy the **anon public** key (a long string starting `eyJ...`).
4. Open `js/supabase-config.js` in the site folder and paste them in:

   ```js
   window.SUPABASE_URL = 'https://abcdefgh.supabase.co';
   window.SUPABASE_ANON_KEY = 'eyJ...';
   ```

   The anon key is designed to be public — it's safe in the site code.
   What visitors can do with it is controlled by the security policies
   created in Step 2 (read published profiles, register a profile —
   nothing else; no edits or deletes from the browser).

5. Re-deploy the site to Netlify (drag and drop the **whole folder**,
   including the new `js/` directory).

## Step 4 — Verify it worked
1. On the live site, open **View Page Source** on `/onboarding.html` and
   confirm you can see `/js/supabase-config.js` near the bottom — if not,
   the deploy didn't include the new files.
2. Complete the CV wizard with test data and click **View My Profile**.
   The URL should end in `?id=` followed by a long code — that means it
   saved to the database. (`?local=1` means it's still in demo mode —
   check the config file was deployed with your keys in it.)
3. Open `/scout-board.html` in a **different browser or incognito
   window** — your test player should appear at the top with a "New"
   badge. That proves the data is coming from the database, not the
   browser.
4. In Supabase, go to **Table Editor → players** — your test row should
   be there. You can untick `published` on any row to hide it from the
   Scout Board, or delete test rows entirely.

## Managing registrations
- **Hide a profile:** Table Editor → players → set `published` to false.
- **Delete a profile:** Table Editor → players → delete the row.
- **Uploaded files** (headshots and highlight videos) live in
  **Storage → headshots / highlight-videos**.

## What's deliberately NOT enabled yet
- Players cannot edit or delete profiles from the browser (no public
  update/delete policies). This is the safe default for launch.
- Registration doesn't yet require login. Once Netlify Identity is
  enabled and tested, the insert policy can be tightened to
  authenticated users only — flag it when you're ready.
