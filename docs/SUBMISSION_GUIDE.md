# Publish IMovies: GitHub link + public demo link

This guide is for a student project/mentor review. You will create:

1. A **GitHub repository** containing the source code.
2. A **MongoDB Atlas** database that keeps movies, users and bookings.
3. A **Render web service** that runs the React website and Express API together.
4. Two working URLs to paste into your submission portal.

You need your own GitHub, MongoDB Atlas and Render accounts. Do not send account passwords, database connection strings, JWT secrets or Stripe keys to anyone helping you in chat.

**Important:** this walkthrough creates a clearly labeled, no-charge review deployment. It does not charge cards and is not a real-ticket sales deployment. Use a dedicated database with fictional customer data.

## Before you begin

- Use the updated `IMovies-full-source.zip` supplied with this guide.
- Install **Node.js 22 LTS** and npm on your computer.
- Install **Git** from https://git-scm.com/downloads.
- Extract the ZIP into a folder named `imovies`. Its `package.json` should be directly inside that folder, not inside another nested folder.
- Keep `.env`, `.env.hosted`, database passwords and secret keys out of GitHub. The included `.gitignore` excludes them.

The example URLs below are placeholders. Replace them with the actual URLs from your accounts before submitting anything.

## 1. Create the GitHub repository and upload the code

1. Sign in to https://github.com.
2. Select **+ → New repository**.
3. Repository name: `imovies`.
4. Description: `MERN cinema booking platform with user and admin dashboards`.
5. Choose **Public** so your mentor can review it without requesting access.
6. **Do not** check Add README, Add .gitignore or Choose a license. This project already includes those files.
7. Select **Create repository**.
8. Open a terminal in your extracted `imovies` folder. On Windows, open the folder in File Explorer, type `cmd` in the address bar and press Enter.
9. Run these commands, replacing `YOUR-USERNAME` with your actual GitHub username:

```bash
git init -b main
git add .
git status --short
git commit -m "Initial IMovies cinema booking project"
git remote add origin https://github.com/YOUR-USERNAME/imovies.git
git push -u origin main
```

If Git asks for your name/email, configure them using your GitHub name and the email associated with your account. If a browser sign-in window appears, authorize Git through GitHub. Do not put a password or token inside the repository URL.

**Check before pushing:** `git status --short` must not list `.env`, `.env.hosted`, `node_modules`, database files or private keys. If it does, stop and fix the exclusion before committing.

Your GitHub submission link will look like:

```text
https://github.com/YOUR-USERNAME/imovies
```

Open that URL in a private browser window. You should see the README and the `client`, `server` and `docs` folders.

## 2. Create a persistent MongoDB Atlas database

Atlas offers an M0 free cluster for learning and small proofs of concept. See the official setup guide: [1](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).

1. Create/sign in to your account at https://cloud.mongodb.com.
2. Create a project named `IMovies-Review`.
3. Create a cluster/deployment. Choose **M0 Free**, AWS, and **Singapore** if available, matching the Render region in `render.yaml`.
4. Skip unrelated sample datasets. IMovies supplies its own cinema data.
5. Under **Database Access**, create a database user such as `imovies_app` with a new, strong password. This is a database account, not your Atlas login. Give it read/write access to the review database; do not use an Atlas administrator account for the application.
6. Under **Network Access**, add your current computer's IP address so you can seed the database from your computer.
7. Select **Connect → Drivers**, choose Node.js, and copy the connection string.
8. Insert `/imovies_review` immediately before the `?` and replace the password placeholder with your database user's password. It should have this shape:

```text
mongodb+srv://imovies_app:YOUR_DATABASE_PASSWORD@YOUR-CLUSTER.mongodb.net/imovies_review?retryWrites=true&w=majority
```

Use the real hostname Atlas gives you. If your password contains URL-special characters, URL-encode it or generate an alphanumeric password in Atlas. Keep the complete URI private.

The database name must be exactly `imovies_review` for the included review-seeding command.

## 3. Generate private reviewer credentials and seed Atlas

In the same local project folder, run:

```bash
npm ci
npm run setup:hosted
```

`setup:hosted` creates a private `.env.hosted` file with unique reviewer/admin passwords and a random JWT secret. It does not print those passwords.

1. Open `.env.hosted` in a text editor.
2. Replace only `MONGODB_URI` with your complete Atlas URI from step 2.
3. Leave `REVIEW_DATABASE_CONFIRM=YES` after confirming this is a disposable review database.
4. Optionally change the reviewer/admin email addresses. Keep the generated strong passwords, or replace them with your own strong, different passwords.
5. Save the file and run:

```bash
npm run seed:review
```

This connects from your computer to Atlas and creates the sample movies, cinemas, seats, shows and review accounts. It skips seeding if users already exist; it does not reset passwords or overwrite bookings.

If the connection times out, check the Atlas username/password, database name and your computer's IP access entry. Do not disable database authentication.

**Private mentor credentials:** copy `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` and, if your mentor needs to evaluate administration, `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env.hosted`. Share them through your portal's private reviewer-notes field or another private channel. Never commit them to GitHub or put them in a public README.

## 4. Deploy the public website on Render

The repository includes `render.yaml`, which builds the React app and runs Express from the same HTTPS origin.

1. Create/sign in to https://dashboard.render.com using your GitHub account.
2. Select **New → Blueprint**.
3. Connect GitHub if prompted and authorize the `imovies` repository.
4. Select the repository and branch `main`.
5. Use the default blueprint path, `render.yaml`.
6. When prompted for `MONGODB_URI`, paste the same private Atlas URI used in `.env.hosted`.
7. Review the service: it should be a **Web Service**, **Free** plan, Singapore region. This setup uses Atlas for MongoDB, not Render Postgres.
8. Select **Deploy Blueprint** and wait for the build and deployment to finish.

Render's official Blueprint walkthrough: https://render.com/docs/infrastructure-as-code.

### Allow Render to reach Atlas

After the service exists:

1. Open the service in Render.
2. Select **Connect → Outbound** and copy its outbound IP ranges.
3. In Atlas **Network Access**, add those ranges alongside your computer's IP.
4. If the first deployment failed while connecting to MongoDB, choose **Manual Deploy → Deploy latest commit** after the Atlas entries become active.

Render documents these ranges at https://render.com/docs/outbound-ip-addresses. They are shared regional ranges, not exclusive addresses. Avoid opening Atlas to the entire internet when these entries are available.

### Find your actual demo URL

At the top of the Render service page, copy the HTTPS URL. It will resemble:

```text
https://imovies-review-xxxx.onrender.com
```

Use the exact URL shown in your dashboard; the example above is not a working project link. The app automatically uses Render's `RENDER_EXTERNAL_URL` as its allowed origin. You do not need to hardcode the URL in React. If you later add a custom domain, set `CLIENT_ORIGIN` to that exact HTTPS origin in Render.

## 5. Test the public demo before submitting

Open the actual Render URL in a private browser window:

- [ ] Homepage and poster images load.
- [ ] `/api/health` returns `{"status":"ok","service":"imovies-api"}`.
- [ ] The banner says this is a demo cinema with no real payments.
- [ ] Sign in using the private reviewer credentials from `.env.hosted`.
- [ ] Choose a movie, a future date and a showtime.
- [ ] Select seats, continue to checkout and simulate a successful payment.
- [ ] The confirmed ticket appears in My bookings.
- [ ] Cancel the test booking and confirm the seats are released.
- [ ] Sign out, then test the private admin credentials and dashboard.
- [ ] Confirm the GitHub repository is visible without signing in.

The public review site intentionally does **not** display prefilled demo account buttons. Registration creates ordinary users only. Admin credentials must be supplied privately.

### Free-hosting limitations

Render's free service can sleep after inactivity and take about a minute to wake; it has usage limits and is intended for demos, not production. Close unused demo tabs so WebSocket traffic does not keep it awake unnecessarily. See [1](https://render.com/docs/free).

Atlas stores the users, movies and bookings persistently. However, Render's free filesystem is temporary: posters newly uploaded through the admin UI can disappear after a restart/redeploy. Bundled posters remain available. For durable uploads, use a paid persistent disk or implement object storage before a real deployment.

Sample shows cover a limited date range. If reviewing later, use the admin console to add future shows. Do not repeatedly reset the database just to refresh the schedule.

## 6. Fill in your submission portal

Return to the screen that says **Add Demo and GitHub links**:

| Portal field                     | What to paste                                                             |
| -------------------------------- | ------------------------------------------------------------------------- |
| **Demo Link**                    | Your actual `https://...onrender.com` website URL                         |
| **GitHub Link**                  | Your actual `https://github.com/YOUR-USERNAME/imovies` repository URL     |
| **Reviewer notes**, if available | Private reviewer/admin credentials and a note that payments are simulated |

Save/submit, then check that the project progress indicator updates. Its percentage is controlled by your portal, not by this application.

Do **not** submit `http://localhost:5173`, a terminal screenshot, the Arena preview URL, a ZIP download link or a link to an empty repository as the demo.

## Troubleshooting

| Symptom                                    | Check                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| Render cannot connect to MongoDB           | Atlas URI/password, `/imovies_review`, and both computer/Render network entries |
| `Demo payments are disabled in production` | Use the updated source and included `render.yaml`; review mode must be explicit |
| Sign-in or booking says Origin not allowed | Use the exact Render HTTPS URL; remove an incorrect `CLIENT_ORIGIN` override    |
| Homepage works but movies are missing      | Run `npm run seed:review` against the same Atlas URI used by Render             |
| Reviewer cannot sign in                    | Use credentials from the filled `.env.hosted`, not the local demo passwords     |
| First visit is slow                        | Wait for the free Render service to wake, then refresh                          |
| Uploaded poster disappears                 | Free Render storage is ephemeral; use bundled/HTTPS images for review           |
| Git push asks for credentials              | Use Git's browser sign-in flow; never paste a token into source code            |

For deployment errors, share the error text with secrets removed. Do not share your `.env` or `.env.hosted` files.

## After the review

Keep the demo only as long as needed. You can suspend/delete the Render service and remove the disposable Atlas cluster when finished. For real customers or money, follow [DEPLOYMENT.md](DEPLOYMENT.md), configure Stripe test/live credentials appropriately, use licensed artwork, and complete the security and operational checklist. Review mode is not a substitute for that work.
