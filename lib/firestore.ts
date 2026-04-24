import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PUBLIC_PARKING_SPOTS } from "@/lib/publicSpots";

export type VehicleType = "bike" | "car" | "suv";
export type SpotStatus = "open" | "closed";
export type VendorStatus = "pending" | "approved" | "rejected";
export type SessionStatus = "booked" | "checked_in" | "checked_out" | "cancelled";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ParkingSpot {
  id?: string;
  name: string;
  address: string;
  location: LatLng;
  vendor_id: string;
  type: "mall" | "municipal" | "private" | "residential" | "roadside";
  vehicle_types: VehicleType[];
  pricing: {
    flat_rate: number;
    hourly_rate: number;
  };
  total_spots: number;
  current_occupancy: number;
  status: SpotStatus;
  is_approved: boolean;
  trust_score: number;
  rating: number;
  review_count: number;
  amenities: string[];
  images: string[];
  availability_schedule: Record<string, { open: string; close: string }>;
  conflict_flag?: boolean;
  created_at?: unknown;
  updated_at?: unknown;
}

export interface Vendor {
  id?: string;
  name: string;
  email: string;
  phone: string;
  status: VendorStatus;
  spots: string[];
  documents: string[];
  revenue_earned: number;
  platform_fee_rate: number;
  created_at?: unknown;
}

export interface Session {
  id?: string;
  user_id: string;
  spot_id: string;
  vehicle_number: string;
  vehicle_type: VehicleType;
  check_in_time: unknown | null;
  check_out_time: unknown | null;
  booking_time?: unknown;
  duration_minutes: number;
  amount: number;
  platform_fee: number;
  payment_method: "upi" | "cash";
  payment_status: "pending" | "paid" | "refunded";
  status: SessionStatus;
  qr_code_data: string;
  check_in_location: LatLng | null;
  rating: number | null;
}

export interface Audit {
  id?: string;
  spot_id: string;
  reporter_user_id: string;
  reported_status: SpotStatus;
  photo_url: string;
  location: LatLng;
  timestamp?: unknown;
  credits_awarded: number;
  conflict_flag: boolean;
}

export interface VendorRegistrationPayload {
  vendor: Pick<Vendor, "name" | "email" | "phone"> & {
    documents?: string[];
    platform_fee_rate?: number;
  };
  spot: Omit<
    ParkingSpot,
    | "id"
    | "vendor_id"
    | "current_occupancy"
    | "status"
    | "is_approved"
    | "trust_score"
    | "rating"
    | "review_count"
    | "created_at"
    | "updated_at"
  >;
}

function withId<T>(id: string, data: T): T & { id: string } {
  return {
    id,
    ...data,
  };
}

function timestampToMillis(value: unknown): number {
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return 0;
}

export async function addSpot(
  payload: Omit<ParkingSpot, "created_at" | "updated_at" | "id">,
): Promise<string> {
  const spotRef = await addDoc(collection(db, "parking_spots"), {
    ...payload,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  return spotRef.id;
}

export async function getSpots(): Promise<Array<ParkingSpot & { id: string }>> {
  const snapshot = await getDocs(collection(db, "parking_spots"));
  return snapshot.docs.map((spotDoc) => withId(spotDoc.id, spotDoc.data() as ParkingSpot));
}

export async function getSpotById(spotId: string): Promise<(ParkingSpot & { id: string }) | null> {
  const snapshot = await getDoc(doc(db, "parking_spots", spotId));
  if (!snapshot.exists()) {
    return null;
  }

  return withId(snapshot.id, snapshot.data() as ParkingSpot);
}

export async function updateSpotOccupancy(spotId: string, delta: number): Promise<void> {
  await updateDoc(doc(db, "parking_spots", spotId), {
    current_occupancy: increment(delta),
    updated_at: serverTimestamp(),
  });
}

export async function toggleSpotStatus(spotId: string, status: SpotStatus): Promise<void> {
  await updateDoc(doc(db, "parking_spots", spotId), {
    status,
    updated_at: serverTimestamp(),
  });
}

export async function registerVendor(
  payload: VendorRegistrationPayload,
): Promise<{ vendorId: string; spotId: string }> {
  const vendorRef = await addDoc(collection(db, "vendors"), {
    name: payload.vendor.name,
    email: payload.vendor.email,
    phone: payload.vendor.phone,
    status: "pending",
    spots: [],
    documents: payload.vendor.documents ?? [],
    revenue_earned: 0,
    platform_fee_rate: payload.vendor.platform_fee_rate ?? 0.15,
    created_at: serverTimestamp(),
  });

  const spotRef = await addDoc(collection(db, "parking_spots"), {
    ...payload.spot,
    vendor_id: vendorRef.id,
    current_occupancy: 0,
    status: "open",
    is_approved: false,
    trust_score: 80,
    rating: 0,
    review_count: 0,
    conflict_flag: false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  await updateDoc(doc(db, "vendors", vendorRef.id), {
    spots: [spotRef.id],
  });

  return { vendorId: vendorRef.id, spotId: spotRef.id };
}

export async function getVendors(): Promise<Array<Vendor & { id: string }>> {
  const snapshot = await getDocs(collection(db, "vendors"));
  return snapshot.docs.map((vendorDoc) => withId(vendorDoc.id, vendorDoc.data() as Vendor));
}

export async function getVendorById(vendorId: string): Promise<(Vendor & { id: string }) | null> {
  const snapshot = await getDoc(doc(db, "vendors", vendorId));
  if (!snapshot.exists()) {
    return null;
  }

  return withId(snapshot.id, snapshot.data() as Vendor);
}

export async function approveVendor(vendorId: string, spotIds: string[]): Promise<void> {
  const batch = writeBatch(db);

  batch.update(doc(db, "vendors", vendorId), {
    status: "approved",
  });

  spotIds.forEach((spotId) => {
    batch.update(doc(db, "parking_spots", spotId), {
      is_approved: true,
      updated_at: serverTimestamp(),
    });
  });

  await batch.commit();
}

export async function rejectVendor(vendorId: string): Promise<void> {
  await updateDoc(doc(db, "vendors", vendorId), {
    status: "rejected",
  });
}

export async function createSession(
  payload: Omit<Session, "id" | "booking_time" | "check_in_time" | "check_out_time">,
): Promise<string> {
  const sessionRef = await addDoc(collection(db, "sessions"), {
    ...payload,
    booking_time: serverTimestamp(),
    check_in_time: null,
    check_out_time: null,
  });

  return sessionRef.id;
}

export async function checkIn(
  sessionId: string,
  spotId: string,
  checkInLocation: LatLng,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const sessionRef = doc(db, "sessions", sessionId);
    const spotRef = doc(db, "parking_spots", spotId);

    transaction.update(sessionRef, {
      status: "checked_in",
      check_in_time: serverTimestamp(),
      check_in_location: checkInLocation,
    });

    transaction.update(spotRef, {
      current_occupancy: increment(1),
      updated_at: serverTimestamp(),
    });
  });
}

export async function checkOut(
  sessionId: string,
  spotId: string,
  amount: number,
  platformFee: number,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const sessionRef = doc(db, "sessions", sessionId);
    const spotRef = doc(db, "parking_spots", spotId);
    const spotSnap = await transaction.get(spotRef);

    if (!spotSnap.exists()) {
      throw new Error("Parking spot not found");
    }

    const vendorId = (spotSnap.data() as ParkingSpot).vendor_id;
    const vendorRef = doc(db, "vendors", vendorId);

    transaction.update(sessionRef, {
      status: "checked_out",
      check_out_time: serverTimestamp(),
      amount,
      platform_fee: platformFee,
      payment_status: "paid",
    });

    transaction.update(spotRef, {
      current_occupancy: increment(-1),
      updated_at: serverTimestamp(),
    });

    transaction.update(vendorRef, {
      revenue_earned: increment(Math.max(amount - platformFee, 0)),
    });
  });
}

export async function submitAudit(
  payload: Omit<Audit, "id" | "timestamp" | "conflict_flag" | "credits_awarded">,
): Promise<{ auditId: string; conflict: boolean; credits: number }> {
  const q = query(
    collection(db, "audits"),
    where("spot_id", "==", payload.spot_id),
    orderBy("timestamp", "desc"),
    limit(10),
  );

  const snapshot = await getDocs(q);
  const cutoff = Date.now() - 30 * 60 * 1000;
  const recentAudits = snapshot.docs
    .map((auditDoc) => auditDoc.data() as Audit)
    .filter((audit) => timestampToMillis(audit.timestamp) >= cutoff);

  const recentHadConflict = recentAudits.some((audit) => Boolean(audit.conflict_flag));
  const reportedStatuses = recentAudits.map((audit) => audit.reported_status);
  reportedStatuses.push(payload.reported_status);

  const hasConflict =
    reportedStatuses.includes("open") && reportedStatuses.includes("closed");

  const credits = hasConflict ? 5 : 2;
  const ref = await addDoc(collection(db, "audits"), {
    ...payload,
    timestamp: serverTimestamp(),
    credits_awarded: credits,
    conflict_flag: hasConflict,
  });

  await runTransaction(db, async (transaction) => {
    const spotRef = doc(db, "parking_spots", payload.spot_id);
    const spotSnap = await transaction.get(spotRef);

    if (!spotSnap.exists()) {
      return;
    }

    const spotData = spotSnap.data() as ParkingSpot;
    const currentTrust = typeof spotData.trust_score === "number" ? spotData.trust_score : 0;
    let nextTrust = currentTrust;

    if (hasConflict && !recentHadConflict) {
      nextTrust = Math.max(currentTrust - 5, 0);
    }

    if (!hasConflict && recentHadConflict) {
      nextTrust = Math.min(currentTrust + 5, 100);
    }

    transaction.update(spotRef, {
      conflict_flag: hasConflict,
      trust_score: nextTrust,
      updated_at: serverTimestamp(),
    });
  });

  return {
    auditId: ref.id,
    conflict: hasConflict,
    credits,
  };
}

export async function getConflicts(spotId: string): Promise<Array<Audit & { id: string }>> {
  const q = query(
    collection(db, "audits"),
    where("spot_id", "==", spotId),
    where("conflict_flag", "==", true),
    orderBy("timestamp", "desc"),
    limit(20),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((auditDoc) => withId(auditDoc.id, auditDoc.data() as Audit));
}

export async function getSpotSessions(
  spotId: string,
  maxRows = 25,
): Promise<Array<Session & { id: string }>> {
  const q = query(
    collection(db, "sessions"),
    where("spot_id", "==", spotId),
    orderBy("booking_time", "desc"),
    limit(maxRows),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((sessionDoc) => withId(sessionDoc.id, sessionDoc.data() as Session));
}

export async function getSessionById(sessionId: string): Promise<(Session & { id: string }) | null> {
  const snapshot = await getDoc(doc(db, "sessions", sessionId));
  if (!snapshot.exists()) {
    return null;
  }

  return withId(snapshot.id, snapshot.data() as Session);
}

export async function markSessionPaid(
  sessionId: string,
  paymentMethod: "upi" | "cash",
): Promise<void> {
  await updateDoc(doc(db, "sessions", sessionId), {
    payment_status: "paid",
    payment_method: paymentMethod,
  });
}

export async function rateSession(sessionId: string, rating: number): Promise<void> {
  await updateDoc(doc(db, "sessions", sessionId), {
    rating,
  });
}

export async function getAllSessions(maxRows = 200): Promise<Array<Session & { id: string }>> {
  const q = query(collection(db, "sessions"), orderBy("booking_time", "desc"), limit(maxRows));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((sessionDoc) => withId(sessionDoc.id, sessionDoc.data() as Session));
}

export async function incrementUserCredits(userId: string, credits: number): Promise<void> {
  await setDoc(
    doc(db, "users", userId),
    {
      credits: increment(credits),
      created_at: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeToSpots(
  onUpdate: (spots: Array<ParkingSpot & { id: string }>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const spotsQuery = query(collection(db, "parking_spots"));

  return onSnapshot(
    spotsQuery,
    (snapshot) => {
      const spots = snapshot.docs.map((spotDoc) => withId(spotDoc.id, spotDoc.data() as ParkingSpot));
      onUpdate(spots);
    },
    (error) => {
      console.error("[Firestore] Spot subscription failed", error);
      onError?.(error as Error);
    },
  );
}

export function subscribeToVendors(
  onUpdate: (vendors: Array<Vendor & { id: string }>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const vendorsQuery = query(collection(db, "vendors"), orderBy("created_at", "desc"));

  return onSnapshot(
    vendorsQuery,
    (snapshot) => {
      const vendors = snapshot.docs.map((vendorDoc) =>
        withId(vendorDoc.id, vendorDoc.data() as Vendor),
      );
      onUpdate(vendors);
    },
    (error) => {
      console.error("[Firestore] Vendor subscription failed", error);
      onError?.(error as Error);
    },
  );
}

export async function ensurePublicParkingSpots(): Promise<void> {
  for (const spot of PUBLIC_PARKING_SPOTS) {
    const spotRef = doc(db, "parking_spots", spot.id);
    const existing = await getDoc(spotRef);

    if (existing.exists()) {
      continue;
    }

    const { id, ...spotPayload } = spot;
    await setDoc(spotRef, {
      ...spotPayload,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  }
}

export function calculatePlatformFee(amount: number, rate: number): number {
  return Number((amount * rate).toFixed(2));
}
