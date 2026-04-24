# ParkSaathi — Full-Stack Parking Marketplace Implementation Plan

> [!IMPORTANT]
> This plan evolves the earlier mock-data architecture into a **real system** with Firebase backend, real-time sync, QR geofencing, and an optimization engine. It is structured for a **24-hour hackathon** with 6 phases and hard verification gates between each.

## Context & Evolution from Previous Work

Your earlier conversation (38056d56) designed a 3-person split with mock JSON data and no backend. This plan **replaces** that approach with:
- **Firebase/Firestore** as the real-time database
- **Firebase Auth** for vendor/admin/user authentication
- **OpenRouteService** for vehicle-specific routing
- **Real optimization algorithm** for spot ranking
- **QR-based check-in/out** with geofencing validation
- **Crowdsourced auditing** with conflict detection

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Vanilla CSS + CSS Variables (dark glassmorphism theme) |
| State | Zustand for client state |
| Backend | Firebase (Auth, Firestore, Storage, Cloud Functions) |
| Maps | Leaflet + OpenStreetMap tiles |
| Routing | OpenRouteService API (free tier) |
| QR | `qrcode.react` for generation, `html5-qrcode` for scanning |
| Charts | Recharts |

---

## 🔒 Git Commit & Push Strategy (MANDATORY)

> [!CAUTION]
> **Never lose work.** The LLM must make frequent commits and push to the remote repo after every meaningful change. In a 24-hour hackathon, a lost codebase is a lost hackathon.

### Rules
1. **Initialize git immediately** in Phase 1 (`git init`, add `.gitignore`, connect remote)
2. **Commit after every completed file or logical unit** — never let more than 15-20 minutes of work go uncommitted
3. **Push after every commit** — local commits alone are not safe
4. **Use descriptive commit messages** following this pattern: `phase-X: <what was done>`

### Mandatory Commit Points (Minimum)

| When | Commit Message |
|------|---------------|
| Project scaffolded + deps installed | `phase-1: scaffold next.js project with dependencies` |
| Firebase config + firestore helpers done | `phase-1: add firebase init and firestore CRUD helpers` |
| Design system (globals.css) + layout done | `phase-1: add design system, layout, navbar, footer` |
| UI components (Button, Card, Badge, Modal) done | `phase-1: add shared UI components` |
| **✅ Phase 1 gate passed** | `phase-1: VERIFIED - foundation complete` |
| Vendor registration form done | `phase-2: add vendor registration portal` |
| Vendor dashboard + live toggle done | `phase-2: add vendor dashboard with live toggle` |
| Admin dashboard done | `phase-2: add admin approval dashboard` |
| **✅ Phase 2 gate passed** | `phase-2: VERIFIED - vendor and admin portals complete` |
| Optimization engine done | `phase-3: add smart discovery ranking algorithm` |
| Map page + components done | `phase-3: add interactive parking map with filters` |
| Routing integration done | `phase-3: add OpenRouteService routing` |
| **✅ Phase 3 gate passed** | `phase-3: VERIFIED - map and optimization complete` |
| Booking flow done | `phase-4: add booking flow with QR generation` |
| QR scanner + geofencing done | `phase-4: add QR scanner with geofence validation` |
| Payment flow done | `phase-4: add payment flow (UPI + cash)` |
| **✅ Phase 4 gate passed** | `phase-4: VERIFIED - booking and QR handshake complete` |
| Crowdsourced auditing done | `phase-5: add crowdsourced auditing with conflict detection` |
| Revenue model integration done | `phase-5: add revenue model and platform fees` |
| **✅ Phase 5 gate passed** | `phase-5: VERIFIED - auditing and revenue complete` |
| Landing page done | `phase-6: add landing page with animations` |
| Polish + responsive pass done | `phase-6: polish UI, responsive fixes, micro-animations` |
| **✅ Phase 6 gate passed** | `phase-6: VERIFIED - demo ready, all gates passed` |

### Emergency Push
- If at any point the LLM is about to start a risky refactor or major change, it must **commit and push the current working state first** as a safety checkpoint
- Tag stable checkpoints: `git tag phase-1-stable`, `git tag phase-2-stable`, etc.

---

## Firestore Data Schema

```
├── parking_spots/{spotId}
│   ├── name: string
│   ├── address: string
│   ├── location: GeoPoint (lat, lng)
│   ├── vendor_id: string (ref → vendors)
│   ├── type: "mall" | "municipal" | "private" | "residential" | "roadside"
│   ├── vehicle_types: ["bike", "car", "suv"]
│   ├── pricing: { flat_rate: number, hourly_rate: number }
│   ├── total_spots: number
│   ├── current_occupancy: number  ← real-time QR updates
│   ├── status: "open" | "closed"  ← vendor live toggle
│   ├── is_approved: boolean       ← admin approval flag
│   ├── trust_score: number (0-100) ← computed from ratings + audits
│   ├── rating: number (1-5)
│   ├── review_count: number
│   ├── amenities: string[]
│   ├── images: string[] (Firebase Storage URLs)
│   ├── availability_schedule: { [day]: { open: string, close: string } }
│   ├── created_at: Timestamp
│   └── updated_at: Timestamp
│
├── vendors/{vendorId}
│   ├── name: string
│   ├── email: string
│   ├── phone: string
│   ├── status: "pending" | "approved" | "rejected"
│   ├── spots: string[] (refs → parking_spots)
│   ├── documents: string[] (Storage URLs for verification)
│   ├── revenue_earned: number
│   ├── platform_fee_rate: number (e.g., 0.15 = 15%)
│   └── created_at: Timestamp
│
├── sessions/{sessionId}
│   ├── user_id: string
│   ├── spot_id: string (ref → parking_spots)
│   ├── vehicle_number: string
│   ├── vehicle_type: "bike" | "car" | "suv"
│   ├── check_in_time: Timestamp | null
│   ├── check_out_time: Timestamp | null
│   ├── booking_time: Timestamp
│   ├── duration_minutes: number
│   ├── amount: number
│   ├── platform_fee: number
│   ├── payment_method: "upi" | "cash"
│   ├── payment_status: "pending" | "paid" | "refunded"
│   ├── status: "booked" | "checked_in" | "checked_out" | "cancelled"
│   ├── qr_code_data: string
│   ├── check_in_location: GeoPoint | null
│   └── rating: number | null
│
├── audits/{auditId}
│   ├── spot_id: string
│   ├── reporter_user_id: string
│   ├── reported_status: "open" | "closed"
│   ├── photo_url: string
│   ├── location: GeoPoint
│   ├── timestamp: Timestamp
│   ├── credits_awarded: number
│   └── conflict_flag: boolean
│
└── users/{userId}
    ├── name: string
    ├── email: string
    ├── phone: string
    ├── vehicle_type: "bike" | "car" | "suv"
    ├── credits: number  ← earned via crowdsourced auditing
    ├── total_sessions: number
    └── created_at: Timestamp
```

---

## Optimization Algorithm

```javascript
// Smart Discovery Engine — ranks spots by composite score
function rankSpots(spots, userLocation, vehicleType) {
  const DISTANCE_WEIGHT = 0.4;
  const PRICE_WEIGHT = 0.3;
  const TRUST_WEIGHT = 0.3;

  const filtered = spots.filter(s =>
    s.is_approved &&
    s.status === "open" &&
    s.current_occupancy < s.total_spots &&
    s.vehicle_types.includes(vehicleType)
  );

  const distances = filtered.map(s => haversine(userLocation, s.location));
  const prices = filtered.map(s => s.pricing.hourly_rate);
  const maxDist = Math.max(...distances);
  const maxPrice = Math.max(...prices);

  return filtered.map((spot, i) => {
    const distScore = 1 - (distances[i] / maxDist);       // closer = higher
    const priceScore = 1 - (prices[i] / maxPrice);        // cheaper = higher
    const trustScore = spot.trust_score / 100;             // 0-1

    const composite =
      (DISTANCE_WEIGHT * distScore) +
      (PRICE_WEIGHT * priceScore) +
      (TRUST_WEIGHT * trustScore);

    return { ...spot, score: composite, distance: distances[i] };
  }).sort((a, b) => b.score - a.score);
}
```

---

## Project Structure

```
c:\Workspace\New folder (5)\
├── app/
│   ├── layout.tsx                    # Root layout (Navbar + Footer)
│   ├── page.tsx                      # Landing page
│   ├── map/page.tsx                  # User: Discovery map
│   ├── booking/page.tsx              # User: Booking + QR
│   ├── payment/page.tsx              # User: Payment flow
│   ├── vendor/
│   │   ├── register/page.tsx         # Vendor registration form
│   │   └── dashboard/page.tsx        # Vendor dashboard + live toggle
│   ├── admin/
│   │   └── dashboard/page.tsx        # Admin: Approve/reject vendors
│   └── scan/page.tsx                 # QR scanner (check-in/out)
├── components/
│   ├── layout/                       # Navbar, Footer, MobileNav
│   ├── landing/                      # Hero, Features, HowItWorks, etc.
│   ├── map/                          # ParkingMap, SpotCard, Filters
│   ├── booking/                      # BookingForm, QRCode, Timer
│   ├── payment/                      # UPI, Cash, Receipt
│   ├── vendor/                       # RegistrationForm, SpotManager
│   ├── admin/                        # VendorTable, ApprovalModal
│   ├── scan/                         # QRScanner, GeofenceValidator
│   └── ui/                           # Button, Card, Badge, Modal
├── lib/
│   ├── firebase.ts                   # Firebase init + helpers
│   ├── firestore.ts                  # Firestore CRUD operations
│   ├── auth.ts                       # Auth helpers
│   ├── optimization.ts              # Ranking algorithm
│   ├── geofence.ts                  # GPS validation (10-20m radius)
│   ├── routing.ts                    # OpenRouteService API calls
│   └── utils.ts                      # Formatting, cn(), etc.
├── store/
│   ├── parkingStore.ts               # Spots + real-time listeners
│   ├── authStore.ts                  # User auth state
│   └── filterStore.ts               # Search/filter state
├── styles/
│   ├── globals.css                   # Design system + CSS variables
│   ├── landing.css
│   ├── map.css
│   ├── booking.css
│   ├── vendor.css
│   ├── admin.css
│   └── scan.css
├── public/
│   └── images/
├── next.config.js
└── package.json
```

---

## Phase 1: Foundation & Firebase Setup (Hours 0–3)

### Goal
Scaffold project, configure Firebase, set up design system, build app shell.

### Tasks

#### [NEW] Project scaffolding
- `npx -y create-next-app@latest ./ --typescript --eslint --app --src-dir=false --import-alias="@/*" --use-npm`
- Install deps: `npm install firebase zustand react-leaflet leaflet recharts qrcode.react html5-qrcode`
- Install dev deps: `npm install -D @types/leaflet`

#### [NEW] [firebase.ts](file:///c:/Workspace/New%20folder%20(5)/lib/firebase.ts)
- Initialize Firebase app with config
- Export `db` (Firestore), `auth` (Auth), `storage` (Storage)
- Set up Firestore real-time listeners helper

#### [NEW] [firestore.ts](file:///c:/Workspace/New%20folder%20(5)/lib/firestore.ts)
- CRUD functions: `addSpot()`, `getSpots()`, `updateSpotOccupancy()`, `toggleSpotStatus()`
- Vendor functions: `registerVendor()`, `approveVendor()`, `rejectVendor()`
- Session functions: `createSession()`, `checkIn()`, `checkOut()`
- Audit functions: `submitAudit()`, `getConflicts()`
- Real-time subscription: `subscribeToSpots()` using `onSnapshot`

#### [NEW] [globals.css](file:///c:/Workspace/New%20folder%20(5)/styles/globals.css)
- Full dark glassmorphism design system (CSS variables from previous architecture)
- `--bg-primary: #0a0a0f`, `--accent-teal: #14b8a6`, glassmorphism utilities, etc.

#### [NEW] [layout.tsx](file:///c:/Workspace/New%20folder%20(5)/app/layout.tsx)
- Root layout with Navbar, Footer, Inter font
- Meta tags for SEO

#### [NEW] components/layout/ — Navbar, Footer, MobileNav
- Navbar links: Home, Find Parking, Marketplace, Vendor, Admin
- Sticky glassmorphism header

#### [NEW] components/ui/ — Button, Card, Badge, Modal
- Shared reusable UI components (typed with TypeScript)

### ✅ Phase 1 Verification Gate
- [ ] `npm run dev` starts without errors
- [ ] Firebase connects successfully (check console for init log)
- [ ] Landing page renders with Navbar + Footer
- [ ] All CSS variables load correctly
- [ ] UI components render in isolation

---

## Phase 2: Vendor Portal & Admin Dashboard (Hours 3–7)

### Goal
Build vendor registration, image upload, admin approval workflow. This is the **supply side** — no spots appear to users until approved.

### Tasks

#### [NEW] [vendor/register/page.tsx](file:///c:/Workspace/New%20folder%20(5)/app/vendor/register/page.tsx)
- Registration form: name, email, phone, business details
- Spot details: name, address, geo-coordinates (manual input + map pin picker)
- Photo upload: drag-and-drop zone → Firebase Storage
- Pricing: flat rate + hourly rate inputs
- Vehicle types: checkboxes (bike, car, SUV)
- Availability schedule: weekly time-slot grid
- Amenities: multi-select (CCTV, Covered, EV Charging, 24/7, etc.)
- On submit → writes to `vendors` + `parking_spots` collections with `is_approved: false`

#### [NEW] [vendor/dashboard/page.tsx](file:///c:/Workspace/New%20folder%20(5)/app/vendor/dashboard/page.tsx)
- **Live Toggle**: prominent Open/Close switch per spot
  - Writes `status: "open"|"closed"` to Firestore in real-time
  - When "Closed": spot visible on map but greyed out, not suggested by engine
- Session list: today's check-ins/check-outs
- Revenue summary: total earned, platform fee deducted
- Occupancy chart (Recharts)

#### [NEW] [admin/dashboard/page.tsx](file:///c:/Workspace/New%20folder%20(5)/app/admin/dashboard/page.tsx)
- Pending vendors table with status filters (Pending/Approved/Rejected)
- Click vendor → modal showing: details, uploaded images, spot location on mini-map
- Approve / Reject buttons → updates `vendors.status` and `parking_spots.is_approved`
- Stats cards: total vendors, pending reviews, total spots live

### ✅ Phase 2 Verification Gate
- [ ] Vendor can register with all fields including photo upload
- [ ] Data appears in Firestore console under `vendors` and `parking_spots`
- [ ] Admin can see pending vendors and approve/reject
- [ ] Approved spots have `is_approved: true` in Firestore
- [ ] Vendor live toggle updates `status` field in real-time
- [ ] **Critical demo test**: Toggle "Closed" on vendor dashboard → verify Firestore field updates instantly

---

## Phase 3: User Discovery Map & Optimization Engine (Hours 7–12)

### Goal
Build the user-facing map with real-time spot markers, smart ranking, search, and filters.

### Tasks

#### [NEW] [optimization.ts](file:///c:/Workspace/New%20folder%20(5)/lib/optimization.ts)
- `rankSpots(spots, userLocation, vehicleType)` — the composite scoring function
- `haversine(point1, point2)` — distance calculation in km
- Normalize distance, price, trust_score into 0–1 range
- Apply weights: Distance 0.4, Price 0.3, Trust 0.3

#### [NEW] [parkingStore.ts](file:///c:/Workspace/New%20folder%20(5)/store/parkingStore.ts)
- Zustand store with Firestore `onSnapshot` listener for real-time updates
- State: `spots[]`, `selectedSpot`, `userLocation`, `isLoading`
- Derived: `rankedSpots` computed via optimization engine
- Export `ParkingSpot` TypeScript type

#### [NEW] [map/page.tsx](file:///c:/Workspace/New%20folder%20(5)/app/map/page.tsx)
- Full-screen Leaflet map centered on Hyderabad [17.385, 78.4867]
- Dynamic import with `ssr: false` for Leaflet
- Vehicle-type toggle: Bike / Car / SUV (filters spots by clearance)
- Search bar: filter by area/landmark
- Filter panel: covered, EV, price range, sort by score/distance/price

#### [NEW] components/map/ — ParkingMap, SpotCard, SearchBar, FilterPanel, SpotList
- **Markers**: color-coded by occupancy (green >50%, yellow 20-50%, red <20%)
- **Closed spots**: grey markers, no "Book" button, "Vendor Closed" badge
- **SpotCard**: shows name, price, occupancy bar, trust score, amenities, "Book Now" button
- **SpotList**: sidebar list ranked by optimization score
- Live occupancy count displayed: "🚗 12/20 spots occupied"

#### [NEW] [routing.ts](file:///c:/Workspace/New%20folder%20(5)/lib/routing.ts)
- OpenRouteService API integration
- `getRoute(origin, destination, vehicleProfile)` — returns GeoJSON polyline
- Vehicle profiles: `cycling-regular` (bike), `driving-car` (car/SUV)
- Pass vehicle dimensions for SUV to avoid narrow lanes
- Display route on map as polyline overlay with turn-by-turn steps

### ✅ Phase 3 Verification Gate
- [ ] Map loads with real spots from Firestore (only `is_approved: true`)
- [ ] Spots are ranked by composite score, not just distance
- [ ] Vehicle type filter works (bike spots don't show for SUV selection)
- [ ] Search and filters narrow results correctly
- [ ] Closed spots appear grey with no "Book" button
- [ ] **Critical demo test**: On Screen 1 (Vendor), toggle "Closed" → On Screen 2 (User map), marker instantly turns grey and "Book" disappears
- [ ] Route displays on map from user location to selected spot
- [ ] Live occupancy count shows on SpotCard

---

## Phase 4: Booking, QR & Geofencing (Hours 12–17)

### Goal
Build the booking flow, QR check-in/out handshake, and geofence validation.

### Tasks

#### [NEW] [geofence.ts](file:///c:/Workspace/New%20folder%20(5)/lib/geofence.ts)
- `validateLocation(userCoords, spotCoords, radiusMeters = 20)` — returns boolean
- Uses Haversine formula to check if user is within 10-20m of spot
- `getCurrentPosition()` — wrapper around navigator.geolocation with error handling

#### [NEW] [booking/page.tsx](file:///c:/Workspace/New%20folder%20(5)/app/booking/page.tsx)
- Read `spotId` from URL params, fetch spot from Firestore
- SpotSummary: name, price, occupancy, rating
- BookingForm: date, time slot, duration, vehicle number, vehicle type
- Live cost calculator
- On submit: create `session` document in Firestore with `status: "booked"`
- Generate QR code data: `{ sessionId, spotId, action: "check_in" }`
- Show QR code + 10-min countdown timer
- "Proceed to Payment" button

#### [NEW] [scan/page.tsx](file:///c:/Workspace/New%20folder%20(5)/app/scan/page.tsx)
- QR Scanner using `html5-qrcode` library
- **onScan workflow**:
  1. Decode QR → extract `sessionId`, `spotId`, `action`
  2. Call `getCurrentPosition()` to get user GPS
  3. Fetch spot location from Firestore
  4. Call `validateLocation(userGPS, spotLocation, 20)`
  5. If **outside geofence**: show error "You must be within 20m of the parking spot"
  6. If **inside geofence + action is "check_in"**:
     - Update session: `status: "checked_in"`, `check_in_time: serverTimestamp()`
     - Update spot: `current_occupancy: increment(1)`
     - Show success: "✅ Checked in! Enjoy your parking"
  7. If **inside geofence + action is "check_out"**:
     - Update session: `status: "checked_out"`, `check_out_time: serverTimestamp()`
     - Update spot: `current_occupancy: increment(-1)`
     - Calculate platform fee, update vendor revenue
     - Prompt for rating/review
     - Show success: "✅ Checked out! Rate your experience"

#### [NEW] [payment/page.tsx](file:///c:/Workspace/New%20folder%20(5)/app/payment/page.tsx)
- UPI mock flow (PhonePe, GPay, Paytm cards)
- Cash flow with OTP confirmation
- Receipt with confetti animation
- "Navigate to Spot" button → route on map

#### [NEW] components/booking/, components/scan/
- BookingForm, SpotSummary, QRCode, Timer
- QRScanner, GeofenceValidator, CheckInSuccess, CheckOutSuccess

### ✅ Phase 4 Verification Gate
- [ ] Booking creates a session document in Firestore
- [ ] QR code generates with correct session data
- [ ] Timer counts down from 10 minutes with color transitions
- [ ] QR scan decodes correctly
- [ ] Geofence validation blocks scan when >20m away (test with mock coordinates)
- [ ] Check-in increments `current_occupancy` in Firestore
- [ ] Check-out decrements `current_occupancy` in Firestore
- [ ] **Critical demo test**: Scan QR → occupancy count updates → map markers reflect new count in real-time
- [ ] Payment flow completes and shows receipt
- [ ] Post-checkout rating prompt appears

---

## Phase 5: Crowdsourced Auditing & Revenue Model (Hours 17–20)

### Goal
Build the crowdsourced verification system and platform revenue tracking.

### Tasks

#### Crowdsourced Auditing (in map/SpotCard or dedicated component)
- "Report Status" button on each spot card
- User takes a photo (camera capture via `<input type="file" capture>`)
- Geofence check: photo upload only unlocks within 20m of spot
- Submit audit: `{ spot_id, reported_status, photo_url, location, timestamp }`
- **Conflict Detection Logic**:
  - If User A reports "Open" but User B reports "Closed" within 30 min → flag spot
  - Flagged spots show "⚠️ Conflicting reports" badge
  - Third user gets incentive prompt: "Verify this spot for 5 credits"
  - After resolution: trust_score adjusted ±5 points
- Credits system: +2 credits per audit, +5 for conflict resolution

#### Revenue Model Integration
- Platform fee: configurable per vendor (default 15%)
- On each check-out: `platform_fee = session.amount * vendor.platform_fee_rate`
- Vendor sees: gross revenue, platform fee, net revenue on their dashboard
- Admin sees: total platform revenue across all vendors

### ✅ Phase 5 Verification Gate
- [ ] User can submit a photo audit with geofence validation
- [ ] Audit document created in Firestore with photo URL
- [ ] Conflicting audits trigger flag on spot
- [ ] Credits awarded to auditing users
- [ ] Platform fee calculated correctly on check-out
- [ ] Vendor dashboard shows revenue breakdown (gross/fee/net)
- [ ] Admin dashboard shows total platform earnings

---

## Phase 6: Polish, Landing Page & Demo Prep (Hours 20–24)

### Goal
Build the stunning landing page, polish all UIs, prepare the two-screen demo.

### Tasks

#### [NEW] [page.tsx](file:///c:/Workspace/New%20folder%20(5)/app/page.tsx) — Landing Page
- Hero: animated gradient, floating parking icons, stat counters
- Features: 7 glassmorphism cards with hover effects
- How It Works: 7-step animated timeline
- Testimonials: 3 user stories
- CTA: gradient section with "Get Started" button

#### Polish & Animations
- Smooth page transitions
- Loading states and skeletons for all data fetches
- Error boundaries with friendly messages
- Mobile responsive pass on all pages
- Micro-animations: hover effects, status transitions, occupancy bar animations

#### Demo Script Preparation
- **Demo 1 — Real-time Sync (THE WOW MOMENT)**:
  - Screen 1: Vendor dashboard → toggle spot "Closed"
  - Screen 2: User map → marker instantly turns grey, "Book" disappears
- **Demo 2 — Full User Journey**:
  - Search → filter by SUV → see ranked spots → book → pay → scan QR → check-in → occupancy updates → check-out → rate
- **Demo 3 — Crowdsourced Auditing**:
  - User reports a spot → second user contradicts → conflict flagged → third user resolves
- **Demo 4 — Revenue Model**:
  - Show vendor dashboard with revenue breakdown and platform fee

### ✅ Phase 6 Verification Gate
- [ ] Landing page is visually stunning with all animations
- [ ] All pages are mobile responsive
- [ ] No console errors on any page
- [ ] Two-screen real-time sync demo works flawlessly
- [ ] Full booking → QR → check-in/out flow works end-to-end
- [ ] Photo audit submission works
- [ ] Revenue numbers are consistent across vendor and admin dashboards

---

## Open Questions

> [!IMPORTANT]
> **Firebase Project**: Do you already have a Firebase project created? I'll need the config values (apiKey, authDomain, projectId, etc.) to initialize. If not, I'll create a placeholder config and you can swap in real values.

> [!IMPORTANT]
> **OpenRouteService API Key**: The free tier gives 2,000 requests/day. Do you have an API key, or should I register one? For the hackathon demo, we can also fall back to Google Maps directions links if ORS is problematic.

> [!WARNING]
> **Scope vs. Time**: This is ambitious for 24 hours. If time runs short, the priority order for what to **cut** is:
> 1. ✅ Keep: Real-time sync demo (Phase 1-3 core)
> 2. ✅ Keep: QR check-in/out with occupancy update (Phase 4 core)
> 3. ⚠️ Simplify: Crowdsourced auditing → reduce to just photo submission without conflict detection
> 4. ⚠️ Simplify: ORS routing → fall back to Google Maps link
> 5. ❌ Cut last: Detailed revenue analytics on admin dashboard

> [!IMPORTANT]
> **Team Split**: Your earlier conversation split work across 3 people. Is this plan for **you alone**, or should I maintain the 3-person workstream structure? The file ownership and push order would change significantly.

## Verification Plan

### Automated Tests
- `npm run build` — ensures no TypeScript or build errors
- Manual Firestore console checks after each write operation
- Browser DevTools → Network tab to verify real-time listener connections

### Live Demo Tests
1. Open two browser windows side-by-side
2. Window 1: Vendor dashboard → toggle spot status
3. Window 2: User map → verify instant marker color change
4. Scan QR → verify occupancy counter changes on both windows
5. Complete full booking flow end-to-end on mobile viewport

### Manual Verification
- Test on mobile viewport (375px width) for all pages
- Verify geofence logic with known coordinates
- Check that closed spots never appear in optimization results
