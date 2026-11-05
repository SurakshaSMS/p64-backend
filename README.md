# Suraksha-SMS — Backend (p64-backend)

A small authentication API for the [Suraksha-SMS mobile app](https://github.com/jayalukito/p64-frontend). It lets users **register** and **log in**, stores accounts in **Cloud Firestore**, and returns a **JWT** access token.

> The backend does **not** receive or process SMS. SMS classification runs entirely on the phone.

**Stack:** Node.js · Express 5 · Firebase Admin SDK (Firestore) · bcryptjs · jsonwebtoken · Jest

---

## Contents

1. [Project structure](#1-project-structure)
2. [Prerequisites](#2-prerequisites)
3. [Firebase setup](#3-firebase-setup)
4. [Environment variables](#4-environment-variables)
5. [Run locally](#5-run-locally)
6. [API reference](#6-api-reference)
7. [Data model](#7-data-model)
8. [Tests](#8-tests)
9. [Deployment](#9-deployment)
10. [Connecting the mobile app](#10-connecting-the-mobile-app)
11. [Known limitations and future work](#11-known-limitations-and-future-work)

---

## 1. Project structure

```
p64-backend/
├─ server.js                    Entry point: checks env vars, sets up Express, mounts /api/auth
├─ config/firebase.js           Initialises Firebase Admin and exports Firestore (db)
├─ routes/authRoutes.js         POST /register, POST /login
├─ controllers/authController.js Validation, password hashing, JWT creation
├─ models/userModel.js          Firestore access for the "users" collection
├─ middlewares/authMiddleware.js Verifies "Authorization: Bearer <token>" (not used by any route yet)
├─ tests/authController.test.js Unit tests (Jest)
└─ .env.example                 Template for environment variables
```

---

## 2. Prerequisites

- **Node.js 18 or newer** (required by `firebase-admin` 13; 22 LTS recommended) and npm
- A **Firebase project** with Cloud Firestore enabled, and a service-account key (see below)

---

## 3. Firebase setup

The backend stores users in Cloud Firestore using the Firebase Admin SDK.

**Firestore is not included with this repository.** The developer taking over the project must set up their own Firebase project and Firestore database, generate a service-account key, and place it in the repository root. (The project used during development, `p64-surakshasms`, belonged to the student team.)

Steps:

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Create a **Cloud Firestore** database (production mode). Choose the region carefully — it cannot be changed later.
3. Go to **Project settings → Service accounts → Generate new private key**. A JSON file downloads.
4. Save the file in the repository root as:

   ```
   p64-surakshasms-firebase-adminsdk-fbsvc-b251ec8c62.json
   ```

   `config/firebase.js` currently loads this exact filename. The file is git-ignored. **Never commit it.**

Firebase Authentication does **not** need to be enabled. Login is handled by this API (bcrypt + JWT).

---

## 4. Environment variables

Copy the template and fill it in:

```bash
cp .env.example .env
```

| Variable | Required | Description | Example |
|---|---|---|---|
| `PORT` | Yes | Port the server listens on | `5000` |
| `JWT_SECRET` | Yes | Secret used to sign tokens. Use a long random value | output of `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Yes | Token lifetime ([format](https://github.com/vercel/ms)) | `7d` |

The server **stops at startup** if any of these is missing. `.env` is git-ignored.

---

## 5. Run locally

```bash
git clone https://github.com/jayalukito/p64-backend.git
cd p64-backend
npm install
cp .env.example .env        # then edit the values
# place the Firebase service-account JSON in the repo root (section 3)
npm run dev                 # auto-restarts on changes (nodemon)
# or: npm start             # plain node server.js
```

Check it is running:

```bash
curl http://localhost:5000/
# Express MVC + Firestore + JWT backend is running
```

---

## 6. API reference

Base URL: `http://<host>:<PORT>/api`. All requests and responses are JSON.

### `POST /api/auth/register`

```json
{ "name": "Example User", "email": "user@example.com", "password": "Password1" }
```

Rules:
- `name`, `email`, `password` are required.
- Password: **at least 8 characters, with one uppercase letter, one lowercase letter and one number** (same rule as the mobile app).
- Email is trimmed and lower-cased; each email can register only once.

Success — `201 Created`:

```json
{
  "success": true,
  "message": "Register successful",
  "data": {
    "user": { "id": "user@example.com", "name": "Example User", "email": "user@example.com", "createdAt": "...", "updatedAt": "..." },
    "accessToken": "<jwt>"
  }
}
```

### `POST /api/auth/login`

```json
{ "email": "user@example.com", "password": "Password1" }
```

Success — `200 OK`, same response shape as register (`message: "Login successful"`).

### Errors

All errors return `{ "success": false, "message": "..." }`.

| Endpoint | Status | Message |
|---|---|---|
| register | 400 | Name, email, and password are required |
| register | 400 | Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, and one number |
| register | 409 | Email is already registered |
| register | 500 | Failed to register user |
| login | 400 | Email and password are required |
| login | 401 | Invalid email or password |
| login | 500 | Failed to login |

### Token

- Payload: `{ id, email }`, signed with `JWT_SECRET`, expires after `JWT_EXPIRES_IN`.
- To protect a future route, add the `protect` middleware from `middlewares/authMiddleware.js`. It expects `Authorization: Bearer <token>`.
- There is no refresh or logout endpoint. A token stays valid until it expires.

---

## 7. Data model

Firestore collection: **`users`**. The document ID is the normalised (lower-case) email.

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `email` | string | lower-case |
| `password` | string | **bcrypt hash** (10 salt rounds). Never store plain text |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

The collection is created automatically when the first user registers.

---

## 8. Tests

```bash
npm test                # run unit tests
npm run test:coverage   # with coverage report (coverage/)
```

`tests/authController.test.js` covers register and login validation, duplicate emails, wrong passwords and error handling. Firestore, bcrypt and JWT are mocked, so no Firebase project is needed to run the tests.

---

## 9. Deployment

**Current status:** not deployed. During the project the app was tested against a backend running locally. Hosting was outside the project scope.

The backend runs on any host that supports a long-running Node.js process (e.g. Render, Railway, Google Cloud Run, a VPS). The hosting account should be owned by the client.

1. Create the service on the hosting platform from this repository (`main` branch).
2. Set the Node version (22 LTS recommended).
3. Set environment variables `PORT` (if the platform does not set it), `JWT_SECRET`, `JWT_EXPIRES_IN`.
4. Provide the Firebase service-account JSON as a **secret file** at the repo root with the filename from section 3. (On Google Cloud you can instead change `config/firebase.js` to `admin.credential.applicationDefault()` and use the service's built-in identity.)
5. Build command: `npm ci` · Start command: `npm start`
6. Make sure the service is served over **HTTPS**.
7. Test `GET /` and a register/login request before pointing the app to it.

---

## 10. Connecting the mobile app

In `p64-frontend/MyApp`, set `EXPO_PUBLIC_API_URL` to this server's URL **including `/api`**:

| Situation | Value |
|---|---|
| Android emulator, backend on your computer | `http://10.0.2.2:5000/api` |
| Real phone on the same Wi-Fi | `http://<computer-LAN-IP>:5000/api` |
| Production | `https://<your-domain>/api` |

Rebuild the app after changing this value.

---

## 11. Known limitations and future work

- **No rate limiting** on login/register (brute-force protection). Out of scope for this project; recommended before public release (e.g. `express-rate-limit`).
- **CORS is open** (`cors()` with no origin list). The mobile app is not affected, but restrict it if a web client is added.
- **Firebase key filename is hard-coded** in `config/firebase.js`. Recommended: load credentials from `GOOGLE_APPLICATION_CREDENTIALS` / Application Default Credentials.
- No refresh tokens, logout or "get current user" endpoint; `authMiddleware.js` is not used yet.
- The `coverage/` folder is committed; it is generated output and can be git-ignored.

---

Developed by Group P64 for ICT30017/ICT30018 ICT Project A/B, Swinburne University of Technology, 2026.
