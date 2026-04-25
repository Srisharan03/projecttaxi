import {
  deleteDoc,
  addDoc,
  arrayUnion,
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
import { haversine } from "@/lib/optimization";

export type VehicleType = "bike" | "car" | "suv";
export type SpotStatus = "open" | "closed";
export type VendorStatus = "pending" | "approved" | "rejected";
export type SessionStatus = "booked" | "checked_in" | "checked_out" | "cancelled";
export type BookingApprovalStatus = "pending" | "accepted" | "rejected";
export type OtpAction = "check_in" | "check_out";

export interface SessionOtp {
  code: string;
  expires_at_ms: number;
  generated_at?: unknown;
  verified_at?: unknown;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ParkingSpot {
  id?: string;
  name: string;
  address: string;
  location: LatLng;
  size_sqft?: number;
  size_yards?: number;
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
  profile_image?: string;
  status: VendorStatus;
  spots: string[];
  documents: string[];
  revenue_earned: number;
  platform_fee_rate: number;
  created_at?: unknown;
}

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  phone: string;
  profile_image?: string;
  created_at?: unknown;
  updated_at?: unknown;
}

export interface Session {
  id?: string;
  access_code: string;
  user_id: string;
  spot_id: string;
  vendor_id: string;
  vehicle_number: string;
  vehicle_type: VehicleType;
  check_in_time: unknown | null;
  check_out_time: unknown | null;
  booking_time?: unknown;
  start_time_iso: string;
  end_time_iso: string;
  start_time_ms: number;
  end_time_ms: number;
  duration_minutes: number;
  amount: number;
  platform_fee: number;
  payment_method: "upi" | "cash";
  payment_status: "pending" | "paid" | "refunded";
  approval_status: BookingApprovalStatus;
  entry_otp?: SessionOtp | null;
  exit_otp?: SessionOtp | null;
  extra_amount?: number;
  overtime_minutes?: number;
  cancellation_reason?: "vendor_rejected" | "slot_expired";
  status: SessionStatus;
  qr_code_data: string;
  check_in_location: LatLng | null;
  rating: number | null;
}

export interface ProcessSessionOtpResult {
  action: OtpAction;
  finalAmount: number;
  extraAmount: number;
  overtimeMinutes: number;
}

export interface SessionExtensionPreview {
  possible: boolean;
  requestedEndMs: number;
  allowedEndMs: number;
  currentEndMs: number;
  requestedExtraMinutes: number;
  allowedExtraMinutes: number;
  requestedExtraAmount: number;
  allowedExtraAmount: number;
  conflictAtMs: number | null;
  note: string;
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
    profile_image?: string;
    platform_fee_rate?: number;
  };
  spots: Array<
    Omit<
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
    >
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

export interface CommunitySpotCluster {
  id?: string;
  location: LatLng;
  tag: string;
  estimated_yards?: number;
  report_image_url?: string;
  report_count: number;
  report_user_ids: string[];
  is_verified: boolean;
  reliability_score: number;
  audit_total_count: number;
  audit_positive_count: number;
  latest_audit_status?: "space_left" | "full";
  latest_audit_message?: string;
  latest_audit_at?: unknown;
  created_by: string;
  created_at?: unknown;
  updated_at?: unknown;
  verified_at?: unknown;
}

export interface CommunitySpotAudit {
  id?: string;
  cluster_id: string;
  user_id: string;
  status: "space_left" | "full";
  message?: string;
  location: LatLng;
  created_at?: unknown;
}

export interface PublicSpotAudit {
  id?: string;
  spot_id: string;
  spot_name: string;
  spot_address: string;
  user_id: string;
  status: "space_left" | "full";
  message?: string;
  location: LatLng;
  created_at?: unknown;
}

export interface ReportCommunitySpotPayload {
  user_id: string;
  location: LatLng;
  tag?: string;
  estimated_yards?: number;
  report_image_url?: string;
}

const COMMUNITY_REPORTS_REQUIRED = 4;

function calculateCommunityReliabilityScore(
  reportCount: number,
  auditPositiveCount: number,
  auditTotalCount: number,
): number {
  const reportSignal = Math.min(reportCount / COMMUNITY_REPORTS_REQUIRED, 1) * 70;
  const auditSignal = auditTotalCount > 0 ? (auditPositiveCount / auditTotalCount) * 30 : 0;
  return Math.round(reportSignal + auditSignal);
}

function intervalsOverlap(
  leftStartMs: number,
  leftEndMs: number,
  rightStartMs: number,
  rightEndMs: number,
): boolean {
  return leftStartMs < rightEndMs && rightStartMs < leftEndMs;
}

function calculateExtensionAmount(hourlyRate: number, extraMinutes: number): number {
  return Number((hourlyRate * (extraMinutes / 60)).toFixed(2));
}

function parseIsoOrMs(iso: string | undefined, ms: number | undefined): number {
  if (typeof ms === "number" && Number.isFinite(ms)) {
    return ms;
  }

  if (iso) {
    const parsed = new Date(iso).getTime();
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function getMaxExtendableEndMs(
  totalSpots: number,
  currentEndMs: number,
  requestedEndMs: number,
  otherSessions: Session[],
): { allowedEndMs: number; conflictAtMs: number | null } {
  if (requestedEndMs <= currentEndMs) {
    return { allowedEndMs: currentEndMs, conflictAtMs: null };
  }

  const maxOthersAllowed = Math.max(totalSpots, 1) - 1;
  const rangeSessions = otherSessions.filter((session) => {
    const startMs = parseIsoOrMs(session.start_time_iso, session.start_time_ms);
    const endMs = parseIsoOrMs(session.end_time_iso, session.end_time_ms);
    if (endMs <= currentEndMs || startMs >= requestedEndMs) {
      return false;
    }

    return true;
  });

  let currentOtherCount = rangeSessions.filter((session) => {
    const startMs = parseIsoOrMs(session.start_time_iso, session.start_time_ms);
    const endMs = parseIsoOrMs(session.end_time_iso, session.end_time_ms);
    return startMs < currentEndMs && endMs > currentEndMs;
  }).length;

  if (currentOtherCount > maxOthersAllowed) {
    return { allowedEndMs: currentEndMs, conflictAtMs: currentEndMs };
  }

  type Event = { timeMs: number; delta: number };
  const events: Event[] = [];
  rangeSessions.forEach((session) => {
    const startMs = Math.max(parseIsoOrMs(session.start_time_iso, session.start_time_ms), currentEndMs);
    const endMs = Math.min(parseIsoOrMs(session.end_time_iso, session.end_time_ms), requestedEndMs);
    if (endMs <= currentEndMs || endMs <= startMs) {
      return;
    }

    events.push({ timeMs: startMs, delta: 1 });
    events.push({ timeMs: endMs, delta: -1 });
  });

  events.sort((left, right) => {
    if (left.timeMs !== right.timeMs) {
      return left.timeMs - right.timeMs;
    }

    return left.delta - right.delta; // End(-1) before start(+1) to honor [start,end) slots
  });

  let index = 0;
  let cursor = currentEndMs;
  while (index < events.length) {
    const eventTime = events[index].timeMs;
    if (eventTime > cursor && currentOtherCount > maxOthersAllowed) {
      return { allowedEndMs: cursor, conflictAtMs: cursor };
    }

    cursor = eventTime;

    while (index < events.length && events[index].timeMs === eventTime) {
      currentOtherCount += events[index].delta;
      index += 1;
    }

    if (currentOtherCount > maxOthersAllowed) {
      return { allowedEndMs: eventTime, conflictAtMs: eventTime };
    }
  }

  return { allowedEndMs: requestedEndMs, conflictAtMs: null };
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

export interface VendorSpotUpdatePayload {
  name?: string;
  address?: string;
  amenities?: string[];
  images?: string[];
  total_spots?: number;
  pricing?: {
    flat_rate: number;
    hourly_rate: number;
  };
}

export async function updateVendorSpot(
  spotId: string,
  payload: VendorSpotUpdatePayload,
): Promise<void> {
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as VendorSpotUpdatePayload;

  await updateDoc(doc(db, "parking_spots", spotId), {
    ...sanitizedPayload,
    updated_at: serverTimestamp(),
  });
}

export async function registerVendor(
  payload: VendorRegistrationPayload,
): Promise<{ vendorId: string; spotIds: string[] }> {
  if (!payload.spots.length) {
    throw new Error("At least one parking spot is required.");
  }

  const start = Date.now();
  console.log("[Firestore.registerVendor] Request received", {
    vendorName: payload.vendor.name,
    email: payload.vendor.email,
    spotCount: payload.spots.length,
  });

  try {
    const vendorRef = await addDoc(collection(db, "vendors"), {
      name: payload.vendor.name,
      email: payload.vendor.email,
      phone: payload.vendor.phone,
      profile_image: payload.vendor.profile_image ?? "",
      status: "pending",
      spots: [],
      documents: payload.vendor.documents ?? [],
      revenue_earned: 0,
      platform_fee_rate: payload.vendor.platform_fee_rate ?? 0.15,
      created_at: serverTimestamp(),
    });

    console.log("[Firestore.registerVendor] Vendor document created", {
      vendorId: vendorRef.id,
      durationMs: Date.now() - start,
    });

    const spotIds = await Promise.all(
      payload.spots.map(async (spot, index) => {
        const { size_sqft, size_yards, ...spotBase } = spot;
        const normalizedSpot = {
          ...spotBase,
          ...(typeof size_sqft === "number" ? { size_sqft } : {}),
          ...(typeof size_yards === "number" ? { size_yards } : {}),
        };

        const spotRef = await addDoc(collection(db, "parking_spots"), {
          ...normalizedSpot,
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

        console.log("[Firestore.registerVendor] Spot document created", {
          index,
          spotId: spotRef.id,
          name: spot.name,
          lat: spot.location.lat,
          lng: spot.location.lng,
          imagesCount: spot.images.length,
        });

        return spotRef.id;
      }),
    );

    await updateDoc(doc(db, "vendors", vendorRef.id), {
      spots: spotIds,
    });

    console.log("[Firestore.registerVendor] Vendor spot list updated", {
      vendorId: vendorRef.id,
      spotIds,
      totalMs: Date.now() - start,
    });

    return { vendorId: vendorRef.id, spotIds };
  } catch (error) {
    console.error("[Firestore.registerVendor] Failed", error);
    throw error;
  }
}

export async function getVendors(): Promise<Array<Vendor & { id: string }>> {
  const snapshot = await getDocs(collection(db, "vendors"));
  return snapshot.docs.map((vendorDoc) => withId(vendorDoc.id, vendorDoc.data() as Vendor));
}

export async function getVendorByEmail(email: string): Promise<(Vendor & { id: string }) | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const exactSnapshot = await getDocs(
    query(collection(db, "vendors"), where("email", "==", email.trim()), limit(1)),
  );
  if (!exactSnapshot.empty) {
    const top = exactSnapshot.docs[0];
    return withId(top.id, top.data() as Vendor);
  }

  const fallbackSnapshot = await getDocs(collection(db, "vendors"));
  const matched = fallbackSnapshot.docs.find((docSnap) => {
    const vendor = docSnap.data() as Vendor;
    return (vendor.email || "").trim().toLowerCase() === normalizedEmail;
  });

  if (!matched) {
    return null;
  }

  return withId(matched.id, matched.data() as Vendor);
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

export async function updateVendorProfile(
  vendorId: string,
  payload: Pick<Vendor, "name" | "email" | "phone"> & { profile_image?: string },
): Promise<void> {
  const normalizedName = payload.name.trim();
  const normalizedEmail = payload.email.trim();
  const normalizedPhone = payload.phone.trim();

  if (!normalizedName || !normalizedEmail || !normalizedPhone) {
    throw new Error("Name, email, and phone are required.");
  }

  await updateDoc(doc(db, "vendors", vendorId), {
    name: normalizedName,
    email: normalizedEmail,
    phone: normalizedPhone,
    profile_image: payload.profile_image?.trim() || "",
    updated_at: serverTimestamp(),
  });
}

export interface CreateSessionPayload {
  user_id: string;
  spot_id: string;
  vehicle_number: string;
  vehicle_type: VehicleType;
  start_time_iso: string;
  end_time_iso: string;
  start_time_ms: number;
  end_time_ms: number;
  duration_minutes: number;
  amount: number;
  payment_method: "upi" | "cash";
  payment_status: "pending" | "paid" | "refunded";
  qr_code_data: string;
}

function generateBookingAccessCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "";
  for (let index = 0; index < 6; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    value += alphabet[randomIndex];
  }
  return value;
}

async function generateUniqueBookingAccessCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateBookingAccessCode();
    const existing = await getDocs(
      query(collection(db, "sessions"), where("access_code", "==", candidate), limit(1)),
    );
    if (existing.empty) {
      return candidate;
    }
  }

  throw new Error("Unable to generate booking code right now. Please try again.");
}

export async function createSession(payload: CreateSessionPayload): Promise<string> {
  if (payload.end_time_ms <= payload.start_time_ms) {
    throw new Error("End time must be after start time.");
  }

  const spotSnapshot = await getDoc(doc(db, "parking_spots", payload.spot_id));
  if (!spotSnapshot.exists()) {
    throw new Error("Selected parking spot was not found.");
  }

  const spot = spotSnapshot.data() as ParkingSpot;
  if (spot.status !== "open") {
    throw new Error("Selected parking spot is currently closed.");
  }

  const sessionsQuery = query(
    collection(db, "sessions"),
    where("spot_id", "==", payload.spot_id),
    where("status", "in", ["booked", "checked_in"]),
  );
  const activeSessionsSnap = await getDocs(sessionsQuery);

  const overlaps = activeSessionsSnap.docs.filter((sessionDoc) => {
    const session = sessionDoc.data() as Session;
    if (session.approval_status === "rejected") {
      return false;
    }

    return intervalsOverlap(
      payload.start_time_ms,
      payload.end_time_ms,
      session.start_time_ms,
      session.end_time_ms,
    );
  });

  if (overlaps.length >= Math.max(spot.total_spots, 1)) {
    throw new Error("That time slot is not available. Please choose a different time.");
  }

  const accessCode = await generateUniqueBookingAccessCode();

  const sessionRef = await addDoc(collection(db, "sessions"), {
    ...payload,
    access_code: accessCode,
    vendor_id: spot.vendor_id,
    approval_status: "pending",
    platform_fee: 0,
    status: "booked",
    booking_time: serverTimestamp(),
    check_in_time: null,
    check_out_time: null,
    check_in_location: null,
    rating: null,
  });

  return sessionRef.id;
}

export async function previewSessionExtension(
  sessionId: string,
  requestedEndMs: number,
): Promise<SessionExtensionPreview> {
  const sessionSnapshot = await getDoc(doc(db, "sessions", sessionId));
  if (!sessionSnapshot.exists()) {
    throw new Error("Session not found.");
  }

  const session = withId(sessionSnapshot.id, sessionSnapshot.data() as Session);
  if ((session.approval_status ?? "accepted") !== "accepted") {
    throw new Error("Only accepted bookings can be extended.");
  }
  if (!(session.status === "booked" || session.status === "checked_in")) {
    throw new Error("Only active bookings can be extended.");
  }

  const currentEndMs = parseIsoOrMs(session.end_time_iso, session.end_time_ms);
  if (requestedEndMs <= currentEndMs) {
    throw new Error("Extended end time must be after current end time.");
  }

  const [spotSnapshot, activeSessionsSnap] = await Promise.all([
    getDoc(doc(db, "parking_spots", session.spot_id)),
    getDocs(
      query(
        collection(db, "sessions"),
        where("spot_id", "==", session.spot_id),
        where("status", "in", ["booked", "checked_in"]),
      ),
    ),
  ]);

  if (!spotSnapshot.exists()) {
    throw new Error("Parking spot not found.");
  }

  const spot = spotSnapshot.data() as ParkingSpot;
  const otherSessions = activeSessionsSnap.docs
    .filter((docSnap) => docSnap.id !== session.id)
    .map((docSnap) => docSnap.data() as Session)
    .filter((candidate) => candidate.approval_status !== "rejected");
  const hasAnyFutureBooking = otherSessions.some((candidate) => {
    const startMs = parseIsoOrMs(candidate.start_time_iso, candidate.start_time_ms);
    return startMs >= currentEndMs;
  });

  const { allowedEndMs, conflictAtMs } = getMaxExtendableEndMs(
    spot.total_spots,
    currentEndMs,
    requestedEndMs,
    otherSessions,
  );

  const requestedExtraMinutes = Math.max(0, Math.ceil((requestedEndMs - currentEndMs) / (60 * 1000)));
  const allowedExtraMinutes = Math.max(0, Math.ceil((allowedEndMs - currentEndMs) / (60 * 1000)));
  const requestedExtraAmount = calculateExtensionAmount(spot.pricing.hourly_rate, requestedExtraMinutes);
  const allowedExtraAmount = calculateExtensionAmount(spot.pricing.hourly_rate, allowedExtraMinutes);

  if (allowedExtraMinutes <= 0) {
    return {
      possible: false,
      requestedEndMs,
      allowedEndMs: currentEndMs,
      currentEndMs,
      requestedExtraMinutes,
      allowedExtraMinutes: 0,
      requestedExtraAmount,
      allowedExtraAmount: 0,
      conflictAtMs,
      note: "Extension is not possible. Slot is already occupied for your requested range.",
    };
  }

  if (allowedEndMs < requestedEndMs) {
    return {
      possible: true,
      requestedEndMs,
      allowedEndMs,
      currentEndMs,
      requestedExtraMinutes,
      allowedExtraMinutes,
      requestedExtraAmount,
      allowedExtraAmount,
      conflictAtMs,
      note: "Partial extension available until the next booking starts.",
    };
  }

  return {
    possible: true,
    requestedEndMs,
    allowedEndMs,
    currentEndMs,
    requestedExtraMinutes,
    allowedExtraMinutes,
    requestedExtraAmount,
    allowedExtraAmount,
    conflictAtMs: null,
    note: hasAnyFutureBooking
      ? "Requested extension is fully available."
      : "No future bookings found for this slot. You can extend further if needed.",
  };
}

export async function extendSession(
  sessionId: string,
  requestedEndMs: number,
): Promise<SessionExtensionPreview> {
  const sessionRef = doc(db, "sessions", sessionId);
  const preview = await previewSessionExtension(sessionId, requestedEndMs);
  if (!preview.possible || preview.allowedExtraMinutes <= 0) {
    throw new Error("No extendable slot is available for this booking.");
  }

  await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists()) {
      throw new Error("Session not found.");
    }

    const current = sessionSnap.data() as Session;
    if ((current.approval_status ?? "accepted") !== "accepted") {
      throw new Error("Only accepted bookings can be extended.");
    }
    if (!(current.status === "booked" || current.status === "checked_in")) {
      throw new Error("Only active bookings can be extended.");
    }

    const currentEndMs = parseIsoOrMs(current.end_time_iso, current.end_time_ms);
    if (currentEndMs !== preview.currentEndMs) {
      throw new Error("Booking changed recently. Please check extension again.");
    }

    const durationMinutes = Math.max(
      1,
      Math.ceil((preview.allowedEndMs - parseIsoOrMs(current.start_time_iso, current.start_time_ms)) / (60 * 1000)),
    );

    transaction.update(sessionRef, {
      end_time_ms: preview.allowedEndMs,
      end_time_iso: new Date(preview.allowedEndMs).toISOString(),
      duration_minutes: durationMinutes,
      amount: Number(((current.amount || 0) + preview.allowedExtraAmount).toFixed(2)),
      updated_at: serverTimestamp(),
    });
  });

  return {
    ...preview,
    note:
      preview.allowedEndMs < preview.requestedEndMs
        ? "Partial extension applied until the next booking starts."
        : "Extension applied successfully.",
  };
}

export async function checkIn(
  sessionId: string,
  spotId: string,
  checkInLocation: LatLng,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const sessionRef = doc(db, "sessions", sessionId);
    const spotRef = doc(db, "parking_spots", spotId);
    const sessionSnap = await transaction.get(sessionRef);

    if (!sessionSnap.exists()) {
      throw new Error("Session not found.");
    }

    const session = sessionSnap.data() as Session;
    if ((session.approval_status ?? "accepted") !== "accepted") {
      throw new Error("Booking request is not accepted by vendor yet.");
    }
    if (session.status === "checked_in") {
      throw new Error("Session is already checked in.");
    }
    if (session.status === "checked_out" || session.status === "cancelled") {
      throw new Error("This session can no longer be checked in.");
    }

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
  markAsPaid = false,
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
      payment_status: markAsPaid ? "paid" : "pending",
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

export function subscribeToSessionById(
  sessionId: string,
  onUpdate: (session: (Session & { id: string }) | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const sessionRef = doc(db, "sessions", sessionId);

  return onSnapshot(
    sessionRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }

      onUpdate(withId(snapshot.id, snapshot.data() as Session));
    },
    (error) => {
      console.error("[Firestore] Session subscription failed", error);
      onError?.(error as Error);
    },
  );
}

export async function getSessionByAccessCode(
  accessCode: string,
): Promise<(Session & { id: string }) | null> {
  const normalized = accessCode.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const snapshot = await getDocs(
    query(collection(db, "sessions"), where("access_code", "==", normalized), limit(1)),
  );

  if (snapshot.empty) {
    return null;
  }

  const first = snapshot.docs[0];
  return withId(first.id, first.data() as Session);
}

function getOtpFieldPrefix(action: OtpAction): "entry_otp" | "exit_otp" {
  return action === "check_in" ? "entry_otp" : "exit_otp";
}

function generateSixDigitOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function generateSessionOtp(
  sessionId: string,
  action: OtpAction,
): Promise<{ code: string; expiresAtMs: number }> {
  const sessionRef = doc(db, "sessions", sessionId);
  const snapshot = await getDoc(sessionRef);

  if (!snapshot.exists()) {
    throw new Error("Session not found.");
  }

  const session = snapshot.data() as Session;
  if ((session.approval_status ?? "accepted") !== "accepted") {
    throw new Error("Vendor has not accepted this booking yet.");
  }

  if (action === "check_in" && session.status !== "booked") {
    throw new Error("Entry OTP can only be generated before check-in.");
  }

  if (action === "check_out" && session.status !== "checked_in") {
    throw new Error("Exit OTP can only be generated after check-in.");
  }

  if (action === "check_in") {
    const nowMs = Date.now();
    if (nowMs < session.start_time_ms) {
      throw new Error("Entry OTP is available only at your scheduled start time.");
    }

    if (nowMs > session.end_time_ms) {
      await updateDoc(sessionRef, {
        status: "cancelled",
        approval_status: "rejected",
        cancellation_reason: "slot_expired",
        updated_at: serverTimestamp(),
      });
      throw new Error("Your time slot has passed away. This booking is now rejected.");
    }
  }

  const code = generateSixDigitOtp();
  const expiresAtMs = Date.now() + 10 * 60 * 1000;
  const fieldPrefix = getOtpFieldPrefix(action);

  await updateDoc(sessionRef, {
    [`${fieldPrefix}.code`]: code,
    [`${fieldPrefix}.expires_at_ms`]: expiresAtMs,
    [`${fieldPrefix}.generated_at`]: serverTimestamp(),
    [`${fieldPrefix}.verified_at`]: null,
  });

  return { code, expiresAtMs };
}

export async function processSessionOtp(
  sessionId: string,
  spotId: string,
  action: OtpAction,
  otpCode: string,
  location: LatLng,
): Promise<ProcessSessionOtpResult> {
  if (!/^\d{6}$/.test(otpCode)) {
    throw new Error("OTP must be exactly 6 digits.");
  }

  let result: ProcessSessionOtpResult = {
    action,
    finalAmount: 0,
    extraAmount: 0,
    overtimeMinutes: 0,
  };

  await runTransaction(db, async (transaction) => {
    const sessionRef = doc(db, "sessions", sessionId);
    const spotRef = doc(db, "parking_spots", spotId);

    const [sessionSnap, spotSnap] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(spotRef),
    ]);

    if (!sessionSnap.exists()) {
      throw new Error("Session not found.");
    }
    if (!spotSnap.exists()) {
      throw new Error("Parking spot not found.");
    }

    const session = sessionSnap.data() as Session;
    const spot = spotSnap.data() as ParkingSpot;

    if (session.spot_id !== spotId) {
      throw new Error("Session does not belong to this spot.");
    }
    if ((session.approval_status ?? "accepted") !== "accepted") {
      throw new Error("Booking request is not accepted by vendor yet.");
    }

    if (action === "check_in") {
      const nowMs = Date.now();
      if (nowMs < session.start_time_ms) {
        throw new Error("Entry verification is allowed only during the scheduled slot time.");
      }

      if (nowMs > session.end_time_ms) {
        transaction.update(sessionRef, {
          status: "cancelled",
          approval_status: "rejected",
          cancellation_reason: "slot_expired",
          updated_at: serverTimestamp(),
        });
        throw new Error("Your time slot has passed away. This booking is now rejected.");
      }
    }

    const fieldPrefix = getOtpFieldPrefix(action);
    const otp = (session[fieldPrefix] as SessionOtp | null | undefined) ?? null;

    if (!otp?.code || !otp.expires_at_ms) {
      throw new Error(`${action === "check_in" ? "Entry" : "Exit"} OTP is not generated yet.`);
    }
    if (otp.code !== otpCode) {
      throw new Error("Invalid OTP. Please check and retry.");
    }
    if (Date.now() > otp.expires_at_ms) {
      throw new Error("OTP expired. Generate a new OTP.");
    }

    if (action === "check_in") {
      if (session.status !== "booked") {
        throw new Error("Session is not in a valid state for check-in.");
      }

      transaction.update(sessionRef, {
        status: "checked_in",
        check_in_time: serverTimestamp(),
        check_in_location: location,
        [`${fieldPrefix}.verified_at`]: serverTimestamp(),
      });

      transaction.update(spotRef, {
        current_occupancy: increment(1),
        updated_at: serverTimestamp(),
      });

      result = {
        action,
        finalAmount: Number((session.amount || 0).toFixed(2)),
        extraAmount: 0,
        overtimeMinutes: 0,
      };
      return;
    }

    if (session.status !== "checked_in") {
      throw new Error("Session is not in a valid state for check-out.");
    }

    const vendorRef = doc(db, "vendors", spot.vendor_id);
    const vendorSnap = await transaction.get(vendorRef);
    const vendorRate =
      vendorSnap.exists() && typeof (vendorSnap.data() as Vendor).platform_fee_rate === "number"
        ? (vendorSnap.data() as Vendor).platform_fee_rate
        : 0.15;

    const overtimeMinutes = Math.max(0, Math.ceil((Date.now() - session.end_time_ms) / (60 * 1000)));
    const extraAmount = Number((spot.pricing.hourly_rate * (overtimeMinutes / 60)).toFixed(2));
    const finalAmount = Number(((session.amount || 0) + extraAmount).toFixed(2));
    const platformFee = calculatePlatformFee(finalAmount, vendorRate);

    transaction.update(sessionRef, {
      status: "checked_out",
      check_out_time: serverTimestamp(),
      amount: finalAmount,
      extra_amount: extraAmount,
      overtime_minutes: overtimeMinutes,
      platform_fee: platformFee,
      payment_status: "pending",
      [`${fieldPrefix}.verified_at`]: serverTimestamp(),
    });

    transaction.update(spotRef, {
      current_occupancy: increment(-1),
      updated_at: serverTimestamp(),
    });

    if (vendorSnap.exists()) {
      transaction.update(vendorRef, {
        revenue_earned: increment(Math.max(finalAmount - platformFee, 0)),
      });
    }

    result = {
      action,
      finalAmount,
      extraAmount,
      overtimeMinutes,
    };
  });

  return result;
}

export async function processSessionOtpByAccessCode(
  accessCode: string,
  action: OtpAction,
  otpCode: string,
): Promise<ProcessSessionOtpResult> {
  const session = await getSessionByAccessCode(accessCode);
  if (!session) {
    throw new Error("Booking code not found.");
  }

  const spot = await getSpotById(session.spot_id);
  if (!spot) {
    throw new Error("Parking spot not found for this booking.");
  }

  // Use spot location as verified terminal location to avoid user-side geolocation dependency.
  return processSessionOtp(session.id, session.spot_id, action, otpCode, spot.location);
}

export async function respondToBookingRequest(
  sessionId: string,
  decision: "accepted" | "rejected",
): Promise<void> {
  const sessionRef = doc(db, "sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) {
    throw new Error("Booking request not found.");
  }

  const session = sessionSnap.data() as Session;
  const currentApproval = session.approval_status ?? "accepted";

  if (currentApproval !== "pending") {
    throw new Error("This booking request is already processed.");
  }

  if (decision === "rejected") {
    await updateDoc(sessionRef, {
      approval_status: "rejected",
      status: "cancelled",
      cancellation_reason: "vendor_rejected",
      updated_at: serverTimestamp(),
    });
    return;
  }

  const spotSnap = await getDoc(doc(db, "parking_spots", session.spot_id));
  if (!spotSnap.exists()) {
    throw new Error("Parking spot not found for this request.");
  }

  const spot = spotSnap.data() as ParkingSpot;
  const sessionsQuery = query(
    collection(db, "sessions"),
    where("spot_id", "==", session.spot_id),
    where("status", "in", ["booked", "checked_in"]),
  );
  const activeSessionsSnap = await getDocs(sessionsQuery);

  const overlappingAccepted = activeSessionsSnap.docs.filter((activeDoc) => {
    if (activeDoc.id === sessionId) {
      return false;
    }

    const active = activeDoc.data() as Session;
    if ((active.approval_status ?? "accepted") !== "accepted") {
      return false;
    }

    return intervalsOverlap(
      session.start_time_ms,
      session.end_time_ms,
      active.start_time_ms,
      active.end_time_ms,
    );
  }).length;

  if (overlappingAccepted >= Math.max(spot.total_spots, 1)) {
    throw new Error("Cannot accept request. Slot capacity is full for this time range.");
  }

  await updateDoc(sessionRef, {
    approval_status: "accepted",
    updated_at: serverTimestamp(),
  });
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

export function subscribeToSessions(
  onUpdate: (sessions: Array<Session & { id: string }>) => void,
  onError?: (error: Error) => void,
  maxRows = 300,
): Unsubscribe {
  const sessionsQuery = query(collection(db, "sessions"), orderBy("booking_time", "desc"), limit(maxRows));

  return onSnapshot(
    sessionsQuery,
    (snapshot) => {
      const sessions = snapshot.docs.map((sessionDoc) =>
        withId(sessionDoc.id, sessionDoc.data() as Session),
      );
      onUpdate(sessions);
    },
    (error) => {
      console.error("[Firestore] Session subscription failed", error);
      onError?.(error as Error);
    },
  );
}

export function subscribeToUserSessions(
  userId: string,
  onUpdate: (sessions: Array<Session & { id: string }>) => void,
  onError?: (error: Error) => void,
  maxRows = 300,
): Unsubscribe {
  const sessionsQuery = query(
    collection(db, "sessions"),
    where("user_id", "==", userId),
    limit(maxRows),
  );

  return onSnapshot(
    sessionsQuery,
    (snapshot) => {
      const sessions = snapshot.docs
        .map((sessionDoc) => withId(sessionDoc.id, sessionDoc.data() as Session))
        .sort((left, right) => timestampToMillis(right.booking_time) - timestampToMillis(left.booking_time));
      onUpdate(sessions);
    },
    (error) => {
      console.error("[Firestore] User session subscription failed", error);
      onError?.(error as Error);
    },
  );
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

export async function reportCommunitySpot(
  payload: ReportCommunitySpotPayload,
): Promise<{ clusterId: string; reportCount: number; isVerified: boolean }> {
  const normalizedUserId = payload.user_id.trim();
  const normalizedEstimatedYards =
    typeof payload.estimated_yards === "number" && Number.isFinite(payload.estimated_yards) && payload.estimated_yards > 0
      ? Number(payload.estimated_yards.toFixed(1))
      : undefined;
  const normalizedReportImageUrl =
    typeof payload.report_image_url === "string" && payload.report_image_url.trim()
      ? payload.report_image_url.trim()
      : undefined;
  if (!normalizedUserId) {
    throw new Error("User ID is required to report community spot.");
  }

  const clustersSnapshot = await getDocs(collection(db, "community_spot_clusters"));
  const nearbyCluster = clustersSnapshot.docs
    .map((clusterDoc) => withId(clusterDoc.id, clusterDoc.data() as CommunitySpotCluster))
    .find((cluster) => haversine(cluster.location, payload.location) * 1000 <= 20);

  if (!nearbyCluster) {
    const reportCount = 1;
    const createdRef = await addDoc(collection(db, "community_spot_clusters"), {
      location: payload.location,
      tag: (payload.tag || "Community Public Spot").trim(),
      estimated_yards: normalizedEstimatedYards,
      report_image_url: normalizedReportImageUrl,
      report_count: reportCount,
      report_user_ids: [normalizedUserId],
      is_verified: false,
      reliability_score: calculateCommunityReliabilityScore(reportCount, 0, 0),
      audit_total_count: 0,
      audit_positive_count: 0,
      created_by: normalizedUserId,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      verified_at: null,
    } satisfies Omit<CommunitySpotCluster, "id">);

    return {
      clusterId: createdRef.id,
      reportCount,
      isVerified: false,
    };
  }

  const clusterRef = doc(db, "community_spot_clusters", nearbyCluster.id);
  let response: { clusterId: string; reportCount: number; isVerified: boolean } = {
    clusterId: nearbyCluster.id,
    reportCount: nearbyCluster.report_count,
    isVerified: nearbyCluster.is_verified,
  };

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(clusterRef);
    if (!snapshot.exists()) {
      throw new Error("Community cluster not found.");
    }

    const cluster = snapshot.data() as CommunitySpotCluster;
    const userIds = Array.isArray(cluster.report_user_ids) ? cluster.report_user_ids : [];
    if (userIds.includes(normalizedUserId)) {
      throw new Error("You already reported this community spot.");
    }

    const nextReportCount = userIds.length + 1;
    const nextIsVerified = nextReportCount >= COMMUNITY_REPORTS_REQUIRED;
    const nextAuditTotal = cluster.audit_total_count ?? 0;
    const nextAuditPositive = cluster.audit_positive_count ?? 0;

    transaction.update(clusterRef, {
      report_user_ids: arrayUnion(normalizedUserId),
      report_count: nextReportCount,
      is_verified: nextIsVerified,
      verified_at: nextIsVerified ? serverTimestamp() : cluster.verified_at ?? null,
      tag: payload.tag?.trim() || cluster.tag || "Community Public Spot",
      estimated_yards: normalizedEstimatedYards ?? cluster.estimated_yards ?? null,
      report_image_url: normalizedReportImageUrl ?? cluster.report_image_url ?? null,
      reliability_score: calculateCommunityReliabilityScore(
        nextReportCount,
        nextAuditPositive,
        nextAuditTotal,
      ),
      updated_at: serverTimestamp(),
    });

    response = {
      clusterId: nearbyCluster.id,
      reportCount: nextReportCount,
      isVerified: nextIsVerified,
    };
  });

  return response;
}

export async function addCommunitySpotAudit(
  clusterId: string,
  userId: string,
  status: "space_left" | "full",
  message: string | undefined,
  userLocation: LatLng,
): Promise<void> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error("User ID required for community audit.");
  }
  const normalizedMessage = (message || "").trim().slice(0, 220);

  const clusterRef = doc(db, "community_spot_clusters", clusterId);
  const clusterSnapshot = await getDoc(clusterRef);
  if (!clusterSnapshot.exists()) {
    throw new Error("Community spot not found.");
  }

  const cluster = clusterSnapshot.data() as CommunitySpotCluster;
  const distanceMeters = haversine(cluster.location, userLocation) * 1000;
  if (distanceMeters > 30) {
    throw new Error("You must be within 30 meters of the community spot to audit.");
  }

  await addDoc(collection(db, "community_spot_audits"), {
    cluster_id: clusterId,
    user_id: normalizedUserId,
    status,
    message: normalizedMessage,
    location: userLocation,
    created_at: serverTimestamp(),
  } satisfies Omit<CommunitySpotAudit, "id">);

  const auditsSnapshot = await getDocs(
    query(
      collection(db, "community_spot_audits"),
      where("cluster_id", "==", clusterId),
      orderBy("created_at", "desc"),
      limit(50),
    ),
  );
  const audits = auditsSnapshot.docs.map((auditDoc) => auditDoc.data() as CommunitySpotAudit);
  const auditTotalCount = audits.length;
  const auditPositiveCount = audits.filter((audit) => audit.status === "space_left").length;

  await updateDoc(clusterRef, {
    latest_audit_status: status,
    latest_audit_message: normalizedMessage,
    latest_audit_at: serverTimestamp(),
    audit_total_count: auditTotalCount,
    audit_positive_count: auditPositiveCount,
    reliability_score: calculateCommunityReliabilityScore(
      cluster.report_count ?? 0,
      auditPositiveCount,
      auditTotalCount,
    ),
    updated_at: serverTimestamp(),
  });
}

export async function getCommunitySpotAuditHistory(
  clusterId: string,
  maxRows = 30,
): Promise<Array<CommunitySpotAudit & { id: string }>> {
  const cappedRows = Math.max(1, Math.min(maxRows, 100));
  const auditsSnapshot = await getDocs(
    query(
      collection(db, "community_spot_audits"),
      where("cluster_id", "==", clusterId),
      orderBy("created_at", "desc"),
      limit(cappedRows),
    ),
  );

  return auditsSnapshot.docs.map((auditDoc) => withId(auditDoc.id, auditDoc.data() as CommunitySpotAudit));
}

export async function addPublicSpotAudit(
  spotId: string,
  spotName: string,
  spotAddress: string,
  userId: string,
  status: "space_left" | "full",
  message: string | undefined,
  userLocation: LatLng,
  spotLocation: LatLng,
): Promise<void> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error("User ID required for public spot audit.");
  }

  const distanceMeters = haversine(spotLocation, userLocation) * 1000;
  if (distanceMeters > 60) {
    throw new Error("You must be within 60 meters of the public spot to audit.");
  }

  const normalizedMessage = (message || "").trim().slice(0, 220);

  await addDoc(collection(db, "public_spot_audits"), {
    spot_id: spotId,
    spot_name: spotName.trim() || "Public Spot",
    spot_address: spotAddress.trim() || "Address unavailable",
    user_id: normalizedUserId,
    status,
    message: normalizedMessage,
    location: userLocation,
    created_at: serverTimestamp(),
  } satisfies Omit<PublicSpotAudit, "id">);
}

export async function getPublicSpotAuditHistory(
  spotId: string,
  maxRows = 30,
): Promise<Array<PublicSpotAudit & { id: string }>> {
  const trimmedSpotId = spotId.trim();
  if (!trimmedSpotId) {
    return [];
  }

  const cappedRows = Math.max(1, Math.min(maxRows, 100));
  const auditsSnapshot = await getDocs(
    query(
      collection(db, "public_spot_audits"),
      where("spot_id", "==", trimmedSpotId),
      orderBy("created_at", "desc"),
      limit(cappedRows),
    ),
  );

  return auditsSnapshot.docs.map((auditDoc) => withId(auditDoc.id, auditDoc.data() as PublicSpotAudit));
}

export async function deleteCommunitySpotCluster(clusterId: string): Promise<void> {
  await deleteDoc(doc(db, "community_spot_clusters", clusterId));

  const auditsSnapshot = await getDocs(
    query(collection(db, "community_spot_audits"), where("cluster_id", "==", clusterId), limit(500)),
  );

  if (!auditsSnapshot.empty) {
    const batch = writeBatch(db);
    auditsSnapshot.docs.forEach((auditDoc) => {
      batch.delete(auditDoc.ref);
    });
    await batch.commit();
  }
}

export function subscribeToCommunitySpots(
  onUpdate: (clusters: Array<CommunitySpotCluster & { id: string }>) => void,
  onError?: (error: Error) => void,
  options?: { verifiedOnly?: boolean; maxRows?: number },
): Unsubscribe {
  const base = collection(db, "community_spot_clusters");
  const verifiedOnly = options?.verifiedOnly === true;
  const maxRows = options?.maxRows ?? 300;

  const communityQuery = verifiedOnly
    ? query(base, where("is_verified", "==", true), limit(maxRows))
    : query(base, limit(maxRows));

  return onSnapshot(
    communityQuery,
    (snapshot) => {
      const rows = snapshot.docs
        .map((clusterDoc) => withId(clusterDoc.id, clusterDoc.data() as CommunitySpotCluster))
        .sort((left, right) => (right.report_count ?? 0) - (left.report_count ?? 0));
      onUpdate(rows);
    },
    (error) => {
      console.error("[Firestore] Community spot subscription failed", error);
      onError?.(error as Error);
    },
  );
}

export async function getUserProfile(userId: string): Promise<(UserProfile & { id: string }) | null> {
  const trimmedId = userId.trim();
  if (!trimmedId) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "users", trimmedId));
  if (!snapshot.exists()) {
    return null;
  }

  return withId(snapshot.id, snapshot.data() as UserProfile);
}

export async function upsertUserProfile(
  userId: string,
  payload: Pick<UserProfile, "name" | "email" | "phone"> & { profile_image?: string },
): Promise<void> {
  const trimmedId = userId.trim();
  if (!trimmedId) {
    throw new Error("User ID is required.");
  }

  const normalizedName = payload.name.trim();
  const normalizedEmail = payload.email.trim();
  const normalizedPhone = payload.phone.trim();
  if (!normalizedName || !normalizedEmail || !normalizedPhone) {
    throw new Error("Name, email, and phone are required.");
  }

  await setDoc(
    doc(db, "users", trimmedId),
    {
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      profile_image: payload.profile_image?.trim() || "",
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
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

    const spotPayload = Object.fromEntries(
      Object.entries(spot).filter(([key]) => key !== "id"),
    );
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
