import fs from "node:fs";
import path from "node:path";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, doc, getDocs, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, ".env.local");

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}.`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const env = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const env = loadEnvFromFile(envPath);

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!Object.values(firebaseConfig).every(Boolean)) {
  throw new Error("Missing one or more NEXT_PUBLIC_FIREBASE_* values in .env.local");
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const REGIONAL_CENTER = { lat: 17.5105, lng: 78.3922 }; // Miyapur-JNTU-Bachupally-Kukatpally corridor center

const parkingImageSets = [
  [
    "https://images.pexels.com/photos/210182/pexels-photo-210182.jpeg",
    "https://images.pexels.com/photos/2996/parking-lot-underground-garage.jpg",
  ],
  [
    "https://images.pexels.com/photos/753876/pexels-photo-753876.jpeg",
    "https://images.pexels.com/photos/1004409/pexels-photo-1004409.jpeg",
  ],
  [
    "https://images.pexels.com/photos/164634/pexels-photo-164634.jpeg",
    "https://images.pexels.com/photos/830054/pexels-photo-830054.jpeg",
  ],
  [
    "https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg",
    "https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg",
  ],
  [
    "https://images.pexels.com/photos/2990650/pexels-photo-2990650.jpeg",
    "https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg",
  ],
];

const vendors = [
  { name: "Metro Parkings", email: "vendor01@parksaathi.demo", phone: "+91 9110000001", lat: 17.5608, lng: 78.3718 }, // Bachupally
  { name: "City Wheels Parking", email: "vendor02@parksaathi.demo", phone: "+91 9110000002", lat: 17.5566, lng: 78.3656 }, // Bachupally west
  { name: "Prime Slots", email: "vendor03@parksaathi.demo", phone: "+91 9110000003", lat: 17.5501, lng: 78.3867 }, // Bachupally east
  { name: "SafePark Hub", email: "vendor04@parksaathi.demo", phone: "+91 9110000004", lat: 17.5009, lng: 78.3693 }, // Miyapur
  { name: "Orbit Parking Co", email: "vendor05@parksaathi.demo", phone: "+91 9110000005", lat: 17.4948, lng: 78.3594 }, // Miyapur south
  { name: "Urban Slot Center", email: "vendor06@parksaathi.demo", phone: "+91 9110000006", lat: 17.4988, lng: 78.3929 }, // JNTU
  { name: "ParkRight Services", email: "vendor07@parksaathi.demo", phone: "+91 9110000007", lat: 17.4937, lng: 78.3976 }, // JNTU metro side
  { name: "RapidPark Stations", email: "vendor08@parksaathi.demo", phone: "+91 9110000008", lat: 17.4898, lng: 78.4096 }, // Kukatpally
  { name: "Civic Parking Point", email: "vendor09@parksaathi.demo", phone: "+91 9110000009", lat: 17.4841, lng: 78.4188 }, // Kukatpally Y junction
  { name: "BlueLot Parking", email: "vendor10@parksaathi.demo", phone: "+91 9110000010", lat: 17.4784, lng: 78.4257 }, // Kukatpally south-east
];

const syntheticRegionalSpots = [
  { id: "seed-spot-bachupally-01", name: "Bachupally Market Plaza Parking", locality: "Bachupally Main Road", area: "Bachupally", lat: 17.5547, lng: 78.3817, vendor_id: "seed-vendor-01" },
  { id: "seed-spot-bachupally-02", name: "Mallampet Connector Parking", locality: "Mallampet Connector", area: "Bachupally", lat: 17.5654, lng: 78.3741, vendor_id: "seed-vendor-02" },
  { id: "seed-spot-bachupally-03", name: "Bachupally Residency Block A", locality: "Residential Block A", area: "Bachupally", lat: 17.5534, lng: 78.3607, vendor_id: "seed-vendor-03" },
  { id: "seed-spot-bachupally-04", name: "JNTU Main Gate Parking", locality: "JNTU Main Road", area: "JNTU", lat: 17.4925, lng: 78.3922, vendor_id: "seed-vendor-06" },
  { id: "seed-spot-bachupally-05", name: "JNTU Metro Link Parking", locality: "JNTU Metro Side", area: "JNTU", lat: 17.4952, lng: 78.3994, vendor_id: "seed-vendor-07" },
  { id: "seed-spot-bachupally-06", name: "Nizampet-JNTU Link Lot", locality: "Nizampet X Road", area: "JNTU", lat: 17.5001, lng: 78.3879, vendor_id: "seed-vendor-04" },
  { id: "seed-spot-bachupally-07", name: "Miyapur Metro Belt Parking", locality: "Miyapur Metro Road", area: "Miyapur", lat: 17.4971, lng: 78.3578, vendor_id: "seed-vendor-05" },
  { id: "seed-spot-bachupally-08", name: "Miyapur Crossroad Parking Hub", locality: "Miyapur X Roads", area: "Miyapur", lat: 17.5014, lng: 78.3651, vendor_id: "seed-vendor-04" },
  { id: "seed-spot-bachupally-09", name: "Pragathi Nagar Edge Parking", locality: "Pragathi Nagar Link", area: "Miyapur", lat: 17.5073, lng: 78.3748, vendor_id: "seed-vendor-05" },
  { id: "seed-spot-bachupally-10", name: "Kukatpally Housing Board Lot", locality: "KPHB 5th Phase", area: "Kukatpally", lat: 17.4912, lng: 78.4048, vendor_id: "seed-vendor-08" },
  { id: "seed-spot-bachupally-11", name: "Kukatpally Y Junction Parking", locality: "Y Junction", area: "Kukatpally", lat: 17.4848, lng: 78.4127, vendor_id: "seed-vendor-09" },
  { id: "seed-spot-bachupally-12", name: "Kukatpally South Service Lane", locality: "Balanagar Side", area: "Kukatpally", lat: 17.4799, lng: 78.4239, vendor_id: "seed-vendor-10" },
];

const users = [
  { name: "Aarav Sharma", email: "user01@parksaathi.demo", phone: "+91 9000000001" },
  { name: "Diya Patel", email: "user02@parksaathi.demo", phone: "+91 9000000002" },
  { name: "Rohan Mehta", email: "user03@parksaathi.demo", phone: "+91 9000000003" },
  { name: "Isha Reddy", email: "user04@parksaathi.demo", phone: "+91 9000000004" },
  { name: "Vikram Nair", email: "user05@parksaathi.demo", phone: "+91 9000000005" },
  { name: "Sneha Gupta", email: "user06@parksaathi.demo", phone: "+91 9000000006" },
  { name: "Karan Yadav", email: "user07@parksaathi.demo", phone: "+91 9000000007" },
  { name: "Ananya Das", email: "user08@parksaathi.demo", phone: "+91 9000000008" },
  { name: "Rahul Verma", email: "user09@parksaathi.demo", phone: "+91 9000000009" },
  { name: "Maya Singh", email: "user10@parksaathi.demo", phone: "+91 9000000010" },
];
const seededUserIds = users.map((_, index) => `seed-user-${String(index + 1).padStart(2, "0")}`);

function buildVendorSpot(vendor, index) {
  const imageSet = parkingImageSets[index % parkingImageSets.length];
  const spotId = `seed-spot-vendor-${String(index + 1).padStart(2, "0")}`;
  const bikeHourly = 15 + (index % 4) * 3;
  const carHourly = 35 + (index % 5) * 6;
  const suvHourly = carHourly + 18 + (index % 3) * 4;
  const bikeFlat = bikeHourly + 8;
  const carFlat = carHourly + 20;
  const suvFlat = suvHourly + 26;

  return {
    id: spotId,
    name: `${vendor.name} - Metro Corridor Spot`,
    address: `West Hyderabad corridor (${vendor.lat.toFixed(4)}, ${vendor.lng.toFixed(4)})`,
    location: {
      lat: vendor.lat,
      lng: vendor.lng,
    },
    size_sqft: 220,
    vendor_id: `seed-vendor-${String(index + 1).padStart(2, "0")}`,
    type: "private",
    vehicle_types: ["bike", "car", "suv"],
    pricing: {
      flat_rate: carFlat,
      hourly_rate: carHourly,
    },
    vehicle_pricing: {
      bike: { flat_rate: bikeFlat, hourly_rate: bikeHourly },
      car: { flat_rate: carFlat, hourly_rate: carHourly },
      suv: { flat_rate: suvFlat, hourly_rate: suvHourly },
    },
    total_spots: 12 + (index % 6),
    current_occupancy: Math.max(0, 2 + (index % 5)),
    status: "open",
    is_approved: true,
    trust_score: 82,
    rating: 4.2,
    review_count: 10 + index,
    amenities: ["CCTV", "Security", "Covered"],
    images: imageSet,
    availability_schedule: {
      monday: { open: "06:00", close: "23:00" },
      tuesday: { open: "06:00", close: "23:00" },
      wednesday: { open: "06:00", close: "23:00" },
      thursday: { open: "06:00", close: "23:00" },
      friday: { open: "06:00", close: "23:00" },
      saturday: { open: "06:00", close: "23:00" },
      sunday: { open: "06:00", close: "23:00" },
    },
    conflict_flag: false,
  };
}

function buildSyntheticRegionalSpot(spot, index) {
  const imageSet = parkingImageSets[index % parkingImageSets.length];
  const totalSpots = 14 + ((index * 3) % 21);
  const occupancy = 4 + (index % 8);
  const bikeHourly = 18 + (index % 5) * 3;
  const carHourly = 40 + (index % 6) * 6;
  const suvHourly = carHourly + 20 + (index % 3) * 4;
  const bikeFlat = bikeHourly + 8;
  const carFlat = carHourly + 24;
  const suvFlat = suvHourly + 28;

  return {
    id: spot.id,
    name: spot.name,
    address: `${spot.locality}, ${spot.area}, Hyderabad (${spot.lat.toFixed(4)}, ${spot.lng.toFixed(4)})`,
    location: {
      lat: spot.lat,
      lng: spot.lng,
    },
    size_sqft: 250 + (index % 5) * 20,
    vendor_id: spot.vendor_id,
    type: "private",
    vehicle_types: index % 3 === 0 ? ["bike", "car"] : ["bike", "car", "suv"],
    pricing: {
      flat_rate: carFlat,
      hourly_rate: carHourly,
    },
    vehicle_pricing: {
      bike: { flat_rate: bikeFlat, hourly_rate: bikeHourly },
      car: { flat_rate: carFlat, hourly_rate: carHourly },
      suv: { flat_rate: suvFlat, hourly_rate: suvHourly },
    },
    total_spots: totalSpots,
    current_occupancy: Math.min(totalSpots - 2, occupancy),
    status: "open",
    is_approved: true,
    trust_score: 74 + (index % 8) * 2,
    rating: Number((3.8 + (index % 6) * 0.13).toFixed(1)),
    review_count: 12 + index * 3,
    amenities: index % 2 === 0 ? ["CCTV", "Security", "Covered"] : ["CCTV", "Security", "EV Charging"],
    images: imageSet,
    availability_schedule: {
      monday: { open: "05:30", close: "23:30" },
      tuesday: { open: "05:30", close: "23:30" },
      wednesday: { open: "05:30", close: "23:30" },
      thursday: { open: "05:30", close: "23:30" },
      friday: { open: "05:30", close: "23:30" },
      saturday: { open: "05:30", close: "23:30" },
      sunday: { open: "06:00", close: "23:00" },
    },
    conflict_flag: false,
  };
}

function formatSeedAccessCode(index) {
  return `S${String(index + 1).padStart(5, "0")}`;
}

function resolvePricingForVehicle(spot, vehicleType) {
  const byVehicle = spot.vehicle_pricing?.[vehicleType];
  if (byVehicle && typeof byVehicle.hourly_rate === "number" && typeof byVehicle.flat_rate === "number") {
    return byVehicle;
  }

  return spot.pricing || { flat_rate: 60, hourly_rate: 45 };
}

function buildSyntheticSessions(spotCatalog) {
  const now = Date.now();
  const preferredSpotIds = [
    "seed-spot-vendor-01",
    "seed-spot-vendor-04",
    "seed-spot-vendor-06",
    "seed-spot-vendor-08",
    "seed-spot-bachupally-01",
    "seed-spot-bachupally-04",
    "seed-spot-bachupally-07",
    "seed-spot-bachupally-10",
    "seed-spot-bachupally-12",
  ];
  const spotPool = preferredSpotIds
    .map((id) => spotCatalog[id])
    .filter(Boolean);

  const plans = [
    { user_id: "demo-user", vehicle_type: "car", vehicle_number: "TS09AB1234", startOffsetMin: -96 * 60, durationMin: 120, status: "checked_out", approval_status: "accepted", payment_method: "upi", payment_status: "paid", rating: 4 },
    { user_id: "demo-user", vehicle_type: "bike", vehicle_number: "TS08CD9081", startOffsetMin: -78 * 60, durationMin: 95, status: "checked_out", approval_status: "accepted", payment_method: "cash", payment_status: "paid", rating: 5 },
    { user_id: "seed-user-01", vehicle_type: "suv", vehicle_number: "TS10EF7743", startOffsetMin: -70 * 60, durationMin: 165, status: "checked_out", approval_status: "accepted", payment_method: "upi", payment_status: "paid", rating: 4 },
    { user_id: "seed-user-02", vehicle_type: "car", vehicle_number: "TS07GH3382", startOffsetMin: -52 * 60, durationMin: 140, status: "checked_out", approval_status: "accepted", payment_method: "upi", payment_status: "paid", rating: 3 },
    { user_id: "demo-user", vehicle_type: "car", vehicle_number: "TS11JK4400", startOffsetMin: -42 * 60, durationMin: 110, status: "cancelled", approval_status: "rejected", payment_method: "upi", payment_status: "refunded", rating: null, cancellation_reason: "vendor_rejected" },
    { user_id: "seed-user-03", vehicle_type: "bike", vehicle_number: "TS13LM2408", startOffsetMin: -28 * 60, durationMin: 85, status: "checked_out", approval_status: "accepted", payment_method: "cash", payment_status: "paid", rating: 4 },
    { user_id: "demo-user", vehicle_type: "suv", vehicle_number: "TS12NP6550", startOffsetMin: -8 * 60, durationMin: 55, status: "checked_out", approval_status: "accepted", payment_method: "upi", payment_status: "paid", rating: 5, overtime_minutes: 25, extra_amount_multiplier: 0.4 },
    { user_id: "demo-user", vehicle_type: "car", vehicle_number: "TS09QX1313", startOffsetMin: -95, durationMin: 240, status: "checked_in", approval_status: "accepted", payment_method: "upi", payment_status: "paid", rating: null },
    { user_id: "seed-user-04", vehicle_type: "bike", vehicle_number: "TS08RT8430", startOffsetMin: -40, durationMin: 130, status: "checked_in", approval_status: "accepted", payment_method: "cash", payment_status: "pending", rating: null },
    { user_id: "demo-user", vehicle_type: "car", vehicle_number: "TS10UV5119", startOffsetMin: 45, durationMin: 90, status: "booked", approval_status: "accepted", payment_method: "upi", payment_status: "pending", rating: null },
    { user_id: "demo-user", vehicle_type: "suv", vehicle_number: "TS09WX2201", startOffsetMin: 3 * 60, durationMin: 180, status: "booked", approval_status: "pending", payment_method: "cash", payment_status: "pending", rating: null },
    { user_id: "seed-user-05", vehicle_type: "car", vehicle_number: "TS07YZ7788", startOffsetMin: 7 * 60, durationMin: 210, status: "booked", approval_status: "accepted", payment_method: "upi", payment_status: "pending", rating: null },
    { user_id: "demo-user", vehicle_type: "bike", vehicle_number: "TS08AA2900", startOffsetMin: 20 * 60, durationMin: 120, status: "booked", approval_status: "accepted", payment_method: "upi", payment_status: "pending", rating: null },
    { user_id: "seed-user-06", vehicle_type: "car", vehicle_number: "TS09BB3311", startOffsetMin: 46 * 60, durationMin: 260, status: "booked", approval_status: "pending", payment_method: "cash", payment_status: "pending", rating: null },
    { user_id: "demo-user", vehicle_type: "suv", vehicle_number: "TS10CC5099", startOffsetMin: 72 * 60, durationMin: 190, status: "booked", approval_status: "accepted", payment_method: "upi", payment_status: "pending", rating: null },
  ];

  return plans.map((plan, index) => {
    const spot = spotPool[index % spotPool.length];
    const startMs = now + plan.startOffsetMin * 60 * 1000;
    const endMs = startMs + plan.durationMin * 60 * 1000;
    const pricing = resolvePricingForVehicle(spot, plan.vehicle_type);
    const baseAmount = Number(Math.max(pricing.flat_rate, pricing.hourly_rate * (plan.durationMin / 60)).toFixed(2));
    const extraAmount = plan.extra_amount_multiplier
      ? Number((pricing.hourly_rate * plan.extra_amount_multiplier).toFixed(2))
      : 0;
    const totalAmount = Number((baseAmount + extraAmount).toFixed(2));
    const checkedIn = plan.status === "checked_in" || plan.status === "checked_out";
    const checkedOut = plan.status === "checked_out";

    return {
      id: `seed-session-${String(index + 1).padStart(2, "0")}`,
      access_code: formatSeedAccessCode(index),
      user_id: plan.user_id,
      spot_id: spot.id,
      vendor_id: spot.vendor_id,
      vehicle_number: plan.vehicle_number,
      vehicle_type: plan.vehicle_type,
      booking_time: new Date(startMs - 30 * 60 * 1000),
      start_time_iso: new Date(startMs).toISOString(),
      end_time_iso: new Date(endMs).toISOString(),
      start_time_ms: startMs,
      end_time_ms: endMs,
      duration_minutes: plan.durationMin,
      amount: totalAmount,
      platform_fee: Number((totalAmount * 0.15).toFixed(2)),
      payment_method: plan.payment_method,
      payment_status: plan.payment_status,
      approval_status: plan.approval_status,
      status: plan.status,
      qr_code_data: `parksaathi:${formatSeedAccessCode(index)}:${spot.id}`,
      check_in_time: checkedIn ? new Date(startMs + 5 * 60 * 1000) : null,
      check_out_time: checkedOut ? new Date(Math.min(endMs, Date.now() - 2 * 60 * 1000)) : null,
      check_in_location: checkedIn ? spot.location : null,
      rating: checkedOut ? plan.rating : null,
      extra_amount: extraAmount > 0 ? extraAmount : 0,
      overtime_minutes: plan.overtime_minutes || 0,
      cancellation_reason: plan.cancellation_reason || null,
      entry_otp: null,
      exit_otp: null,
    };
  });
}

async function seedUsers() {
  for (let index = 0; index < users.length; index += 1) {
    const user = users[index];
    const userId = `seed-user-${String(index + 1).padStart(2, "0")}`;
    await setDoc(
      doc(db, "users", userId),
      {
        name: user.name,
        email: user.email,
        phone: user.phone,
        profile_image: `https://randomuser.me/api/portraits/${index % 2 === 0 ? "men" : "women"}/${20 + index}.jpg`,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

async function seedCommunityDemoSpots() {
  const verifiedClusterId = "seed-community-cluster-vnr-verified";
  const pendingClusterId = "seed-community-cluster-vnr-pending";
  const verifiedLocation = { lat: 17.5449, lng: 78.3897 };
  const pendingLocation = { lat: 17.5417, lng: 78.3938 };

  await setDoc(
    doc(db, "community_spot_clusters", verifiedClusterId),
    {
      location: verifiedLocation,
      tag: "VNR Student Community Parking A",
      estimated_yards: 140,
      report_image_url: "https://images.pexels.com/photos/210182/pexels-photo-210182.jpeg",
      report_count: 10,
      report_user_ids: seededUserIds,
      is_verified: true,
      reliability_score: 92,
      audit_total_count: 10,
      audit_positive_count: 8,
      latest_audit_status: "space_left",
      latest_audit_message: "Multiple student slots free near side gate.",
      latest_audit_at: serverTimestamp(),
      created_by: seededUserIds[0],
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      verified_at: serverTimestamp(),
    },
    { merge: true },
  );

  await setDoc(
    doc(db, "community_spot_clusters", pendingClusterId),
    {
      location: pendingLocation,
      tag: "VNR Student Community Parking B",
      estimated_yards: 110,
      report_image_url: "https://images.pexels.com/photos/164634/pexels-photo-164634.jpeg",
      report_count: 3,
      report_user_ids: seededUserIds.slice(0, 3),
      is_verified: false,
      reliability_score: 58,
      audit_total_count: 10,
      audit_positive_count: 4,
      latest_audit_status: "full",
      latest_audit_message: "Usually full around class closing hours.",
      latest_audit_at: serverTimestamp(),
      created_by: seededUserIds[1],
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      verified_at: null,
    },
    { merge: true },
  );

  // Add user mark activity records (10 users x 2 spots) for demo history.
  for (let index = 0; index < seededUserIds.length; index += 1) {
    const userId = seededUserIds[index];
    const statusA = index % 3 === 0 ? "full" : "space_left";
    const statusB = index % 2 === 0 ? "full" : "space_left";

    await setDoc(
      doc(db, "community_spot_audits", `seed-community-audit-a-${String(index + 1).padStart(2, "0")}`),
      {
        cluster_id: verifiedClusterId,
        user_id: userId,
        status: statusA,
        message: statusA === "space_left" ? "Found slots available." : "Tight but manageable.",
        location: verifiedLocation,
        created_at: serverTimestamp(),
      },
      { merge: true },
    );

    await setDoc(
      doc(db, "community_spot_audits", `seed-community-audit-b-${String(index + 1).padStart(2, "0")}`),
      {
        cluster_id: pendingClusterId,
        user_id: userId,
        status: statusB,
        message: statusB === "space_left" ? "Some space found near corner." : "No slots currently.",
        location: pendingLocation,
        created_at: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

async function seedVendorsAndSpots() {
  const extraSpotIdsByVendor = {};
  for (const spot of syntheticRegionalSpots) {
    if (!extraSpotIdsByVendor[spot.vendor_id]) {
      extraSpotIdsByVendor[spot.vendor_id] = [];
    }
    extraSpotIdsByVendor[spot.vendor_id].push(spot.id);
  }

  for (let index = 0; index < vendors.length; index += 1) {
    const vendor = vendors[index];
    const vendorId = `seed-vendor-${String(index + 1).padStart(2, "0")}`;
    const spot = buildVendorSpot(vendor, index);
    const imageSet = parkingImageSets[index % parkingImageSets.length];

    await setDoc(
      doc(db, "vendors", vendorId),
      {
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        profile_image: `https://randomuser.me/api/portraits/${index % 2 === 0 ? "men" : "women"}/${40 + index}.jpg`,
        status: "approved",
        spots: [spot.id, ...(extraSpotIdsByVendor[vendorId] || [])],
        documents: [
          imageSet[0],
        ],
        revenue_earned: 0,
        platform_fee_rate: 0.15,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );

    await setDoc(
      doc(db, "parking_spots", spot.id),
      {
        ...spot,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );
  }

  for (let index = 0; index < syntheticRegionalSpots.length; index += 1) {
    const syntheticSpot = buildSyntheticRegionalSpot(syntheticRegionalSpots[index], index);
    await setDoc(
      doc(db, "parking_spots", syntheticSpot.id),
      {
        ...syntheticSpot,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

async function clearSessionsCollection() {
  const snapshot = await getDocs(collection(db, "sessions"));
  if (snapshot.empty) {
    return 0;
  }

  let batch = null;
  let batchSize = 0;
  let deleted = 0;

  for (const sessionDoc of snapshot.docs) {
    if (!batch || batchSize >= 400) {
      if (batch && batchSize > 0) {
        await batch.commit();
      }
      batch = writeBatch(db);
      batchSize = 0;
    }

    batch.delete(doc(db, "sessions", sessionDoc.id));
    batchSize += 1;
    deleted += 1;
  }

  if (batch && batchSize > 0) {
    await batch.commit();
  }

  return deleted;
}

async function seedSyntheticSessions() {
  const deletedCount = await clearSessionsCollection();
  if (deletedCount > 0) {
    console.log(`[seed] Cleared ${deletedCount} existing booking sessions.`);
  } else {
    console.log("[seed] No existing booking sessions to clear.");
  }

  const spotSnapshot = await getDocs(collection(db, "parking_spots"));
  const spotCatalog = spotSnapshot.docs.reduce((acc, row) => {
    acc[row.id] = { id: row.id, ...row.data() };
    return acc;
  }, {});

  const sessions = buildSyntheticSessions(spotCatalog);
  for (const session of sessions) {
    await setDoc(
      doc(db, "sessions", session.id),
      {
        ...session,
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );
  }

  console.log(`[seed] Seeded ${sessions.length} synthetic sessions (past/present/future mix).`);
}

async function main() {
  console.log("[seed] Starting regional demo data seed...");
  console.log(`[seed] Center reference: ${REGIONAL_CENTER.lat}, ${REGIONAL_CENTER.lng}`);

  await seedUsers();
  await seedVendorsAndSpots();
  await seedCommunityDemoSpots();
  await seedSyntheticSessions();

  console.log(
    "[seed] Done. Seeded 10 users, 10 vendors, 22 parking spots (Bachupally + JNTU + Miyapur + Kukatpally), 2 community-report spots, and synthetic booking sessions.",
  );
}

main().catch((error) => {
  console.error("[seed] Failed:", error);
  process.exit(1);
});
