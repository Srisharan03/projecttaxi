# ParkSaathi

A full-stack, realtime parking marketplace built with **Next.js 16 (App Router)**, **React 19**, **Firebase**, **Google Maps/Places**, and **Zustand**.

ParkSaathi connects 3 actor groups on one platform:
- **Users** discover, compare, request, and manage parking sessions.
- **Owners** register spots, approve/reject booking requests, and run daily operations.
- **Admins** review owner onboarding and moderate community-reported public spots.

---

## 1. Project Overview

ParkSaathi is designed around a practical parking workflow instead of static listings:
1. User selects a destination and vehicle type.
2. App fetches nearby parking from multiple sources (approved owner spots + Google public spots + verified community clusters).
3. Spots are ranked by a composite engine that factors route efficiency, destination distance, pricing, and trust.
4. User requests a booking for owner spots.
5. Owner accepts/rejects booking requests.
6. User and owner complete entry/exit using time-bound OTPs.
7. Occupancy, status, and revenue update in Firestore in realtime.

---

## 2. Tech Stack

| Layer | Implementation |
|---|---|
| Frontend | Next.js `16.2.4` (App Router), React `19.2.4`, TypeScript |
| State | Zustand (`authStore`, `parkingStore`, `filterStore`) |
| Backend-as-a-Service | Firebase Auth + Firestore realtime subscriptions |
| Maps & Geo | Google Maps JS API + Places + Directions service, OpenRouteService helper |
| Media Uploads | Cloudinary unsigned upload flows |
| Charts/Utilities | Recharts, `qrcode.react`, `html5-qrcode` (legacy/optional UI pieces present) |
| Styling | Modular CSS files under `styles/` + shared UI primitives |

---

## 3. Architecture

### 3.1 High-level architecture

```text
app/* pages (UI routes)
  -> components/* (feature + shared UI)
    -> store/* (client-side state and derived ranking)
      -> lib/* services (auth, firestore, maps, routing, optimization, geofence, uploads)
        -> External services (Firebase, Google Maps/Places, Cloudinary, ORS)
```

### 3.2 Core architectural decisions

- **Client-first App Router implementation**:
  Most feature routes are interactive client pages (`"use client"`) to support realtime listeners, map SDKs, and browser APIs.

- **Realtime-first data flow**:
  Dashboards and booking state sync through Firestore listeners (`subscribeToSpots`, `subscribeToSessions`, `subscribeToVendors`, `subscribeToCommunitySpots`, etc.).

- **Role-driven UX**:
  Navigation, pages, and actions are role-aware (`user`, `vendor`, `admin`) through persisted auth state in Zustand.

- **Composite discovery engine**:
  Ranking is not purely nearest-distance; it combines route efficiency + destination proximity + price + trust score.

- **Operational workflow over static CRUD**:
  The platform implements approval gates, request handling, OTP verification windows, overtime fee calculations, and revenue splits.

---

## 4. Implemented Feature Set (What is actually done)

### 4.1 Authentication and role entry

Implemented in:
- `app/auth/page.tsx`
- `app/auth/user/page.tsx`
- `app/auth/vendor/page.tsx`
- `lib/auth.ts`
- `store/authStore.ts`

What works:
- Email/password sign up and login with Firebase Auth.
- Role selection flow (`user` / `vendor`) persisted in local storage.
- Auth initialization + subscription timeout fallback for resilient client boot.

### 4.2 Parking discovery map (user side)

Implemented in:
- `app/map/page.tsx`
- `components/map/*`
- `lib/googlePlaces.ts`
- `lib/routing.ts`
- `lib/optimization.ts`
- `store/parkingStore.ts`
- `store/filterStore.ts`

What works:
- Destination geocoding via Google Geocoder.
- Nearby public parking fetch via Google Places.
- Merge and dedupe of:
  - approved owner spots from Firestore
  - Google public spots
  - verified community clusters converted into map spots
- Vehicle profile switching (`bike`, `car`, `suv`).
- Route metrics fetched from Google Directions API with fallback estimates.
- Ranked list and map markers with filtering (search, amenities, max price, include closed, sort).
- Route launch through Google Maps directions URL.

### 4.3 Optimization engine

Implemented in:
- `lib/optimization.ts`

Scoring model:
- `routeEfficiencyWeight = 0.5`
- `destinationDistanceWeight = 0.2`
- `priceWeight = 0.15`
- `trustWeight = 0.15`

Derived ranking attributes per spot:
- score
- user-to-spot and destination-to-spot distance
- ETA and route metadata
- traffic factor and road suitability
- availability ratio

### 4.4 Owner onboarding and operations

Implemented in:
- `app/vendor/register/page.tsx`
- `components/vendor/RegistrationForm.tsx`
- `app/vendor/dashboard/page.tsx`
- `app/vendor/requests/page.tsx`
- `app/vendor/profile/page.tsx`

What works:
- Two-step owner registration (owner profile + one/many parking spots).
- Spot location via map pin, geocoding from address, or current GPS.
- File uploads to Cloudinary (profile, documents, spot images).
- Spot CRUD-style edits for name/address/pricing/amenities/images/capacity.
- Live open/closed toggling for spots.
- Booking request queue where owner can accept/reject requests.
- Owner profile editing with Cloudinary image upload.

### 4.5 Booking lifecycle, OTP verification, payment

Implemented in:
- `app/booking/page.tsx`
- `app/scan/page.tsx`
- `app/payment/page.tsx`
- `lib/firestore.ts` (session + OTP transaction logic)

What works:
- User creates booking requests for owner spots with time window and vehicle details.
- Session status workflow:
  - `booked` -> `checked_in` -> `checked_out`
  - `approval_status` handled separately (`pending`, `accepted`, `rejected`)
- Entry/exit OTP generation with expiry.
- OTP verification console for owners using booking access code.
- Transactional check-in/check-out updates:
  - occupancy increment/decrement
  - overtime minutes + extra amount
  - platform fee calculation
  - owner net revenue increment
- Payment status update (`markSessionPaid`) and receipt rendering.
- Session extension preview/apply flow with conflict-aware extension checks.

### 4.6 Admin control panel

Implemented in:
- `app/admin/dashboard/page.tsx`
- `components/admin/*`

What works:
- Owner review queue with status filters (pending/approved/rejected).
- Owner approval/rejection updates across owner and linked spots.
- Platform revenue aggregation from sessions.
- Community cluster moderation panel (pending vs verified, remove cluster, proof image review).

### 4.7 Community public spot reporting and audits

Implemented in:
- `components/community/ReportPublicSpotModal.tsx`
- `components/map/PublicSpotAuditModal.tsx`
- `components/map/ParkingMap.tsx`
- `lib/firestore.ts` community/public audit functions

What works:
- Logged-in users/owners can report new public spots with GPS + optional image proof.
- Clustering and verification threshold logic (verified after enough unique reports).
- Community spot audits (`space_left` / `full`) with optional messages.
- Public spot audit history and proof display from map UI.

### 4.8 Global UX and notifications

Implemented in:
- `components/layout/Navbar.tsx`
- `components/booking/GlobalExpiryReminder.tsx`

What works:
- Role-aware sidebar navigation.
- Booking expiry reminders for users.
- Browser notification prompts for reminders/approvals.
- Owner approval banner and one-time local notification behavior.

---

## 5. Realtime Data Model (Firestore)

Primary collections in use:
- `parking_spots`
- `vendors`
- `sessions`
- `users`
- `audits`
- `community_spot_clusters`
- `community_spot_audits`
- `public_spot_audits`

Important business fields:
- Spot operations: `status`, `is_approved`, `current_occupancy`, `vehicle_types`, pricing.
- Booking lifecycle: `status`, `approval_status`, `entry_otp`, `exit_otp`, `start_time_ms`, `end_time_ms`.
- Revenue model: `amount`, `extra_amount`, `platform_fee`, `revenue_earned`, `platform_fee_rate`.
- Community trust: report counts, audit counts, reliability score, latest audit snapshot.

---

## 6. Project Structure

```text
app/
  page.tsx                       # Landing page
  layout.tsx                     # Root app shell + GoogleMapsProvider + sidebar
  auth/*                         # User/vendor role auth flows
  map/page.tsx                   # Discovery, ranking, map, audits
  booking/page.tsx               # Booking management + OTP generation + extension
  scan/page.tsx                  # Owner OTP verification console
  payment/page.tsx               # Payment status and receipt
  vendor/*                       # Register, dashboard, requests, profile
  admin/dashboard/page.tsx       # Admin review and moderation panel

components/
  admin/, booking/, community/, layout/, map/, payment/, scan/, ui/, vendor/

lib/
  auth.ts, firebase.ts, firestore.ts
  optimization.ts, routing.ts, googlePlaces.ts, geofence.ts
  cloudinary.ts, publicSpots.ts, googleMaps.ts, utils.ts

store/
  authStore.ts, parkingStore.ts, filterStore.ts

styles/
  globals.css + page-level CSS modules

seed/
  seed-vnrv-demo-data.mjs, demo-accounts.json
```

---

## 7. Local Setup

### 7.1 Prerequisites

- Node.js 18+
- npm
- Firebase project (Auth + Firestore enabled)
- Google Maps key (Maps JS + Places enabled)
- Cloudinary unsigned upload preset

### 7.2 Install

```bash
npm install
```

### 7.3 Environment variables

Create `.env.local` in project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_OPENROUTESERVICE_API_KEY=

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
```

### 7.4 Run app

```bash
npm run dev
```

Open: `http://localhost:3000`

---

## 8. Seed and Demo Data

Seed script available:

```bash
npm run seed:vnrv
```

What it seeds:
- demo users and owners
- approved owner spots + regional synthetic spots
- community spot clusters (verified + pending)
- synthetic sessions across past/current/future windows

Reference files:
- `seed/README.md`
- `seed/demo-accounts.json`
- `seed/seed-vnrv-demo-data.mjs`

---

## 9. Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start development server on `0.0.0.0:3000` |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run seed:vnrv` | Seed demo dataset |

---

## 10. Current Implementation Notes

- Booking flow currently uses **OTP-based verification** (booking code + 6-digit OTP) as the active path.
- `processSessionOtpByAccessCode` uses spot location internally to avoid user-device geolocation dependency at owner terminal.
- Several flows use a demo user identity (`demo-user`) in UI-level logic for simplified hackathon operation.
- Firebase config has placeholder fallback warnings if env vars are missing.

---

## 11. Why this architecture works for a hackathon MVP

- Fast to demo: all critical personas are wired and interactive.
- Realtime by default: state updates propagate across actor dashboards.
- Incremental scalability: data model already supports advanced workflows (trust signals, audits, approval gates, fee tracking).
- Practical UX depth: it is not just map pins; it includes operations, verification, and monetization loops.
