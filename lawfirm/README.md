# Ndukwana Attorneys – workflow management portal

React (Vite) + Express + Firebase (Auth, Firestore). Gemini chatbot grounded in the firm's own information.

## Areas
| URL | Who | What |
|---|---|---|
| `/` `/contact` | Public | Website, contact form, WhatsApp / call buttons, social links, chatbot |
| `/login` | Clients | Sliding login / sign-up (email or Google) → `/portal` |
| `/staff` | Staff + supervisors | Team login; sign-up needs an invite code → `/app` |

Client portal: book by case type and attorney, describe the matter, reschedule, cancel, upload documents, notifications.
Team workspace (glass sidebar): Dashboard, Notifications, Documents, Tasks, Assigned cases, Messages, Settings (Notifications / Appearance / Security), Profile (with team members), Log out.
Supervisor extras: All consultations (approve, reassign), Team & invites, Activity log, Website enquiries.

## Where everything is
```
lawfirm/
├── README.md                  this file
├── firebase.json              hosting headers, emulators, rules paths
├── firestore.rules            who can read what (all writes blocked; API only)
├── client/                    React website + client portal + team workspace
│   ├── .env.example           Firebase web config, API URL, WhatsApp number
│   ├── public/                logo files (logo-mark.png, logo-gold.png, logo-full.png)
│   └── src/
│       ├── App.jsx            all routes
│       ├── firebase.js        Firebase web setup
│       ├── context/AuthContext.jsx   login state, role, theme
│       ├── lib/               api.js (calls the server), firm.js (firm details, case types), format.js, useLive.js
│       ├── styles/            global.css, shell.css (glass sidebar), auth.css (sliding login), landing.css
│       ├── components/        Shell.jsx (sidebars), ChatWidget.jsx, Contact.jsx, CaseCard.jsx, ProtectedRoute.jsx, ui.jsx
│       └── pages/
│           ├── Landing.jsx    public website
│           ├── Login.jsx      sliding login / sign-up (clients and staff)
│           ├── portal/        client: Overview, Book, Appointments
│           ├── app/           team: Dashboard, Cases, Tasks, Messages, Consultations, People, Activity, Inbox
│           └── shared/        Documents, Notifications, Settings, Profile
└── server/                    Express API
    ├── .env.example           Firebase service account, Gemini key, optional Slack
    ├── scripts/create-admin.js   creates the first supervisor
    ├── scripts/drive-auth.js     one-time Google Drive connection
    └── src/
        ├── index.js           security middleware and route mounting
        ├── config.js          case types, bookable hours, upload limits
        ├── knowledge.js       what the chatbot is allowed to know (edit firm facts here)
        ├── middleware/auth.js token + role checks
        ├── lib/               firebase.js, storage.js (Vercel Blob), drive.js (Google Drive), notify.js, http.js
        └── routes/            auth, profile, appointments, documents, tasks, admin, contact, chat
```
Run `npm install` inside both `client/` and `server/` after unzipping (node_modules are not included).

## Setup
1. Create a Firebase project. Enable **Authentication** (Email/Password, and Google for client sign-in) and **Firestore**. You do not need Firebase Storage.
2. `firebase deploy --only firestore:rules` (clients can never write data directly, only the API can).
3. **Server:** `cd server && cp .env.example .env`, fill it in (service-account JSON on one line, `GEMINI_API_KEY`), then `npm run dev`.
4. **First supervisor:** `npm run create-admin -- you@firm.co.za "Full Name"` (run on your own machine only). Sign in at `/staff`, open *Team & invites* to invite staff.
5. **Client:** `cd client && cp .env.example .env`, fill in the Firebase web config, then `npm run dev` (Vite proxies `/api` to port 8080).
6. Staff set their case types on *Profile*; clients only see attorneys who handle the case type they pick.

## Document storage (Vercel Blob + Google Drive)
Every upload is saved twice by the server:
1. **Vercel Blob (primary).** Create a Blob store with access set to **Private** (it cannot be changed later). When deploying the server on Vercel, connect the store to the Vercel project; the SDK uses Vercel OIDC. For local development or other hosting providers, add the store's read-write token as `BLOB_READ_WRITE_TOKEN` in `server/.env` (and in the host's server environment). Files are never public; the portal downloads them through `GET /api/documents/:id/file`, which checks who is asking first.

2. **Google Drive (archive copy, optional).** Each client gets a sub-folder in one root folder in the firm's Drive.
   - In Google Cloud Console create a project, enable the **Google Drive API**, configure the OAuth consent screen and **publish it to "In production"** (in "Testing" the connection expires after 7 days), then create an OAuth client of type **Desktop app**.
   - Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `server/.env`, run `npm run drive-auth` on your computer, sign in with the firm's Google account, and copy the printed `GOOGLE_REFRESH_TOKEN` and `GOOGLE_DRIVE_FOLDER_ID` into `.env`.
   - Only the narrow `drive.file` permission is used, so the app can see only the files and folders it created.
   - If Drive is unreachable the client's upload still succeeds; staff see a "Drive copy failed" note.
Deleting a document removes both copies. Do not share the Drive folder widely: anyone with access sees every client's documents.

## Security model
- Roles live in signed Firebase **custom claims** set only by the server. Nothing in the browser can grant a role.
- Every API route verifies the Firebase ID token (revoked tokens rejected), checks the role, and validates input with zod.
- Firestore rules: clients read only their own records; staff only their assigned cases/documents/tasks; supervisors everything. **All writes go through the API.**
- Documents are uploaded only through the API (type checked by file signature, 10 MB max), kept in a private Blob store, and streamed back after a permission check. Staff downloads are logged for the supervisor.
- Staff/supervisor sign-up needs a single-use invite code (stored hashed, expires in 7 days). Supervisors are created only with the script.
- `helmet`, CORS allow-list, rate limits (global, auth, contact form, chatbot), 20 KB JSON limit, no stack traces to clients, source maps disabled, secrets only in `.env`.
- The browser can always see the React code and the public Firebase config. That is normal and safe: protection comes from the rules and API above.
- The chatbot only receives public firm information plus the visitor's question, never client data.

## Free-tier notes
- Documents use Vercel Blob and Google Drive, so Firebase stays on the free Spark plan. Check Vercel Blob's current free allowance and pricing before launch.
- Express can't run on Spark. For now it runs locally (`npm run dev`). When you are ready to go live, host it somewhere (Render, Railway, Vercel, etc.) and set `VITE_API_URL` + `CLIENT_ORIGIN`.
- Gemini free tier may use submitted content to improve Google products and has rate limits. The bot is grounded and cached for that reason.
- Update `server/src/knowledge.js` and `client/src/lib/firm.js` if firm details change. Confirm the WhatsApp number (`VITE_WHATSAPP`) and consultation hours (`server/src/config.js`).

## Optional Slack alerts
Set `SLACK_WEBHOOK_URL` to get generic alerts (e.g. "New consultation request"). No client names or case details are ever sent.

## Languages and the Gemini assistant

- **Server env:** `GEMINI_API_KEY` (required for the chatbot and for translating) and optional `GEMINI_MODEL` (defaults to `gemini-3.8-flash`). The server calls Gemini through the Interactions API in `server/src/lib/gemini.js`.
- **Languages:** all 11 spoken official languages plus South African Sign Language (which shows English text). The list lives in `client/src/i18n/languages.js` and `server/src/languages.js`.
- **How translation works:** English is the source (`client/src/i18n/en.js`). isiZulu, isiXhosa and Afrikaans are hand-written files next to it. The other languages are translated once by Gemini through `POST /api/translate` and cached in the browser and the server. Only interface text is sent, never user data.
- **Adding or changing text:** add the key to `en.js` and use `t('your.key')`. Every language falls back to English until it is translated. Ask a first-language speaker to review legal wording before launch.
- **Chat language:** the chat sends the visitor's chosen language so Gemini replies in it.

## Chatbot checklist
- Open `https://YOUR-API-HOST/api/chat/health` in a browser. `"ok": true` means the chatbot can reach Gemini. Otherwise `problem` says why: `GEMINI_API_KEY is not set`, `key_rejected` (wrong or restricted key), `model_not_found` (set `GEMINI_MODEL`), or `quota_exceeded`.
- The chat tries the Interactions API first, then falls back to `gemini-2.5-flash` (override with `GEMINI_FALLBACK_MODEL`).
- On the client host (Vercel) set `VITE_API_URL` to your API host and redeploy. Without it, `/api/chat` hits your website instead of the server and the chat cannot answer.
- On the server set `CLIENT_ORIGIN` to your website address (comma-separated for several), or the browser blocks the request.
