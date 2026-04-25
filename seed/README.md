# Demo Accounts & Seed Data

This folder contains demo login/account data for quick testing.

- File: `seed/demo-accounts.json`
- Total: 10 users + 10 owners
- Password for all accounts: `123456`

## VNR VJIET map demo seed

Use this to seed Firestore with:
- 10 user profile docs
- 10 owner docs (approved)
- 22 parking spots total:
  - 10 owner anchor spots (spread farther apart for realistic distribution)
  - 12 additional synthetic spots distributed across:
    - Bachupally
    - JNTU
    - Miyapur
    - Kukatpally
- Vehicle-wise pricing in each parking spot (`bike`, `car`, `suv`) with India-relevant rates
- 2 community public spots near VNR for jury demo
  - 1 verified cluster
  - 1 pending cluster
- Synthetic booking data:
  - Clears existing `sessions` collection first
  - Seeds past, present (active), and future booking records
- parking + fake human profile image URLs

Command:

```bash
npm run seed:vnrv
```

Script:
- `seed/seed-vnrv-demo-data.mjs`

Notes:
- The script is idempotent for the seeded IDs (`seed-user-*`, `seed-vendor-*`, `seed-spot-vendor-*`).
- It reads Firebase values from `.env.local` (`NEXT_PUBLIC_FIREBASE_*`).
