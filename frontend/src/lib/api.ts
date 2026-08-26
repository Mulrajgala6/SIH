/**
 * DAKSYNC API client.
 *
 * Single, dependency-free wrapper around `fetch` for the FastAPI backend
 * documented in docs/API_CONTRACT.md. The base URL is configurable via
 * NEXT_PUBLIC_API_URL and defaults to the local backend.
 *
 * Every response shape in the contract has a matching TypeScript type, and
 * every endpoint has a typed function. `apiFetch` centralises headers, JSON
 * encoding and error handling (it throws with the backend `detail` message).
 */
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://sih-production-8bdb.up.railway.app"
).replace(/\/+$/, "");

/* ------------------------------------------------------------------ */
/* Enumerations                                                        */
/* ------------------------------------------------------------------ */

export type Role = "ADMIN" | "SUPERVISOR" | "POSTMAN" | "SENDER" | "RECIPIENT";

export type PreferredLanguage = "en" | "hi";

export type Priority = "NORMAL" | "HIGH" | "URGENT";

export type SlotCode = "MORNING" | "MIDDAY" | "AFTERNOON" | "EVENING";

export type ConsignmentStatus =
  | "BOOKED"
  | "RECEIVED_AT_ORIGIN"
  | "COLLECTED"
  | "SORTED"
  | "IN_TRANSIT"
  | "RECEIVED_AT_DESTINATION"
  | "SLOT_PENDING"
  | "SLOT_CONFIRMED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "DELIVERY_FAILED"
  | "RESCHEDULED"
  | "RETURNED";

export type RouteStatus =
  | "PLANNED"
  | "DISPATCHED"
  | "IN_PROGRESS"
  | "COMPLETED";

export type StopStatus =
  | "PENDING"
  | "ARRIVED"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

export type FailReason =
  | "RECIPIENT_UNAVAILABLE"
  | "WRONG_ADDRESS"
  | "REFUSED"
  | "OTHER";

/* ------------------------------------------------------------------ */
/* Meta                                                                */
/* ------------------------------------------------------------------ */

export type HealthResponse = {
  status: string;
  service: string;
  version: string;
  database: { connected: boolean; engine: string; error: string | null };
};

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export interface UserOut {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  phone: string | null;
  post_office_id?: number | null;
  post_office?: PostOfficeBrief | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserOut;
}

/* ------------------------------------------------------------------ */
/* Slots                                                               */
/* ------------------------------------------------------------------ */

export interface SlotOut {
  id: number;
  code: SlotCode;
  label_en: string;
  label_hi: string;
  start_minutes: number;
  end_minutes: number;
  sort_order: number;
}

export interface SlotOption {
  slot: SlotOut;
  is_recommended: boolean;
  is_feasible: boolean;
  reason_en: string | null;
  reason_hi: string | null;
}

export interface SlotRecommendResponse {
  consignment_id: number;
  recommended_slot_id: number | null;
  options: SlotOption[];
}

export interface SlotConfirmRequest {
  consignment_id: number;
  slot_id: number;
  changed: boolean;
}

export interface SlotConfirmResponse {
  consignment_id: number;
  confirmed_slot_id: number;
  status: ConsignmentStatus;
}

/* ------------------------------------------------------------------ */
/* Consignments                                                        */
/* ------------------------------------------------------------------ */

export interface SenderBrief {
  id: number;
  name: string;
  organization: string | null;
}

export interface RecipientOut {
  id: number;
  name: string;
  phone: string;
  preferred_language: PreferredLanguage;
}

export interface AddressOut {
  id: number;
  line1: string;
  line2: string | null;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  is_geocoded: boolean;
}

export interface PostOfficeOut {
  id: number;
  code: string;
  name: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

export interface ConsignmentOut {
  id: number;
  tracking_number: string;
  status: ConsignmentStatus;
  priority: Priority;
  description: string | null;
  weight_grams: number | null;
  sender: SenderBrief | null;
  recipient: RecipientOut;
  address: AddressOut;
  post_office_id: number | null;
  origin_post_office_id?: number | null;
  bag_number?: string | null;
  post_office?: PostOfficeBrief | null;
  origin_post_office?: PostOfficeBrief | null;
  requested_slot: SlotOut | null;
  recommended_slot: SlotOut | null;
  confirmed_slot: SlotOut | null;
  delivery_date: string | null;
  created_at: string;
}

export interface ConsignmentBrief {
  id: number;
  tracking_number: string;
  status: ConsignmentStatus;
  priority: Priority;
  recipient: RecipientOut;
  address: AddressOut;
  post_office_id?: number | null;
  origin_post_office_id?: number | null;
  bag_number?: string | null;
  confirmed_slot: SlotOut | null;
}

/** Request body for creating a consignment (`ConsignmentCreate`). */
export interface ConsignmentCreate {
  sender_id: number | null;
  sender_name: string | null;
  origin_post_office_id?: number | null;
  recipient: {
    name: string;
    phone: string;
    preferred_language: PreferredLanguage;
  };
  address: {
    line1: string;
    line2: string | null;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    latitude: number | null;
    longitude: number | null;
  };
  description: string | null;
  weight_grams: number | null;
  priority: Priority;
  requested_slot_code: SlotCode | null;
}

/** Request body for `PATCH /consignments/{id}`. */
export interface ConsignmentUpdate {
  status?: ConsignmentStatus;
  priority?: Priority;
}

export interface ListConsignmentsParams {
  status?: ConsignmentStatus;
  post_office_id?: number;
  q?: string;
  limit?: number;
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export interface AgentBrief {
  id: number;
  name: string;
  phone: string | null;
}

export interface RouteStopOut {
  id: number;
  sequence: number;
  status: StopStatus;
  eta_minutes: number | null;
  distance_from_prev_m: number | null;
  consignment: ConsignmentBrief;
}

export interface PostOfficeBrief {
  id: number;
  code: string;
  name: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

export interface RouteOut {
  id: number;
  post_office_id: number;
  post_office?: PostOfficeBrief | null;
  agent: AgentBrief | null;
  route_date: string;
  status: RouteStatus;
  planned_start_minutes: number | null;
  total_distance_m: number | null;
  total_stops: number;
  optimizer: string | null;
  stops: RouteStopOut[];
}

export interface RouteOptimizeRequest {
  post_office_code?: string | null;
  agent_id?: number | null;
  route_date?: string | null;
  start_minutes?: number | null;
}

export interface RouteOptimizeResponse {
  routes: RouteOut[];
  unassigned_consignment_ids: number[];
}

export interface ListRoutesParams {
  route_date?: string;
  post_office_id?: number;
}

/* ------------------------------------------------------------------ */
/* Deliveries                                                          */
/* ------------------------------------------------------------------ */

export interface StartDeliveryResponse {
  consignment_id: number;
  status: ConsignmentStatus;
  otp_sent: boolean;
  demo_otp: string | null;
}

export interface VerifyOtpRequest {
  consignment_id: number;
  code: string;
}

export interface VerifyOtpResponse {
  verified: boolean;
  status: ConsignmentStatus;
  attempts_remaining: number;
  detail: string;
}

export interface FailDeliveryRequest {
  consignment_id: number;
  reason: FailReason;
  notes?: string | null;
}

export interface DeliveryResultOut {
  consignment_id: number;
  status: ConsignmentStatus;
  delivered_at?: string | null;
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export interface StatusBreakdownItem {
  status: ConsignmentStatus;
  count: number;
}

export interface SlotDistributionItem {
  slot_code: SlotCode;
  label_en: string;
  label_hi: string;
  count: number;
}

export interface DashboardOut {
  total_active: number;
  delivered_today: number;
  out_for_delivery: number;
  pending_slot: number;
  failed_today: number;
  first_attempt_success_rate: number;
  routes_planned: number;
  total_route_distance_km: number;
  status_breakdown: StatusBreakdownItem[];
  slot_distribution: SlotDistributionItem[];
}

/* ------------------------------------------------------------------ */
/* Core fetch helper                                                   */
/* ------------------------------------------------------------------ */

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
}

/** Extract a human-readable message from an error response body. */
function extractDetail(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const msgs = detail
        .map((item) =>
          item && typeof item === "object" && "msg" in item
            ? String((item as { msg: unknown }).msg)
            : "",
        )
        .filter(Boolean);
      if (msgs.length) return msgs.join(", ");
    }
  }
  return fallback;
}

/**
 * Perform a JSON request against the backend. `path` must start with `/` and
 * is appended to API_URL. Sets JSON + Authorization headers and throws an
 * Error carrying the backend `detail` message on any non-2xx response.
 */
export async function apiFetch<T>(
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* body was not JSON */
    }
    throw new Error(extractDetail(data, `Request failed (${res.status})`));
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Build a `?a=b&c=d` query string, skipping null/undefined/"" values. */
function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

/* ------------------------------------------------------------------ */
/* Meta endpoints                                                      */
/* ------------------------------------------------------------------ */

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Auth endpoints                                                      */
/* ------------------------------------------------------------------ */

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function getMe(token: string): Promise<UserOut> {
  return apiFetch<UserOut>("/api/v1/auth/me", { token });
}

/* ------------------------------------------------------------------ */
/* Consignment endpoints                                               */
/* ------------------------------------------------------------------ */

export function createConsignment(
  body: ConsignmentCreate,
  token: string,
): Promise<ConsignmentOut> {
  return apiFetch<ConsignmentOut>("/api/v1/consignments", {
    method: "POST",
    body,
    token,
  });
}

export function listConsignments(
  params: ListConsignmentsParams,
  token: string,
): Promise<ConsignmentBrief[]> {
  const query = buildQuery({
    status: params.status,
    post_office_id: params.post_office_id,
    q: params.q,
    limit: params.limit,
  });
  return apiFetch<ConsignmentBrief[]>(`/api/v1/consignments${query}`, { token });
}

/** Public recipient tracking by tracking number. */
export function trackConsignment(
  trackingNumber: string,
): Promise<ConsignmentOut> {
  return apiFetch<ConsignmentOut>(
    `/api/v1/consignments/track/${encodeURIComponent(trackingNumber)}`,
  );
}

export function getConsignment(
  id: number,
  token: string,
): Promise<ConsignmentOut> {
  return apiFetch<ConsignmentOut>(`/api/v1/consignments/${id}`, { token });
}

export function updateConsignment(
  id: number,
  body: ConsignmentUpdate,
  token: string,
): Promise<ConsignmentOut> {
  return apiFetch<ConsignmentOut>(`/api/v1/consignments/${id}`, {
    method: "PATCH",
    body,
    token,
  });
}

/* ------------------------------------------------------------------ */
/* Slot endpoints (public / recipient-facing)                          */
/* ------------------------------------------------------------------ */

export function listSlots(): Promise<SlotOut[]> {
  return apiFetch<SlotOut[]>("/api/v1/slots");
}

export function recommendSlots(
  consignmentId: number,
): Promise<SlotRecommendResponse> {
  return apiFetch<SlotRecommendResponse>(
    `/api/v1/slots/recommend/${consignmentId}`,
  );
}

export function confirmSlot(
  body: SlotConfirmRequest,
): Promise<SlotConfirmResponse> {
  return apiFetch<SlotConfirmResponse>("/api/v1/slots/confirm", {
    method: "POST",
    body,
  });
}

/* ------------------------------------------------------------------ */
/* Route endpoints                                                     */
/* ------------------------------------------------------------------ */

export function optimizeRoutes(
  body: RouteOptimizeRequest,
  token: string,
): Promise<RouteOptimizeResponse> {
  return apiFetch<RouteOptimizeResponse>("/api/v1/routes/optimize", {
    method: "POST",
    body,
    token,
  });
}

export function listRoutes(
  params: ListRoutesParams,
  token: string,
): Promise<RouteOut[]> {
  const query = buildQuery({
    route_date: params.route_date,
    post_office_id: params.post_office_id,
  });
  return apiFetch<RouteOut[]>(`/api/v1/routes${query}`, { token });
}

export function getRoute(id: number, token: string): Promise<RouteOut> {
  return apiFetch<RouteOut>(`/api/v1/routes/${id}`, { token });
}

/* ------------------------------------------------------------------ */
/* Delivery endpoints                                                  */
/* ------------------------------------------------------------------ */

export function startDelivery(
  consignmentId: number,
  token: string,
): Promise<StartDeliveryResponse> {
  return apiFetch<StartDeliveryResponse>(
    `/api/v1/deliveries/start/${consignmentId}`,
    { method: "POST", token },
  );
}

export function verifyOtp(
  body: VerifyOtpRequest,
  token: string,
): Promise<VerifyOtpResponse> {
  return apiFetch<VerifyOtpResponse>("/api/v1/deliveries/verify-otp", {
    method: "POST",
    body,
    token,
  });
}

export function completeDelivery(
  consignmentId: number,
  token: string,
): Promise<DeliveryResultOut> {
  return apiFetch<DeliveryResultOut>("/api/v1/deliveries/complete", {
    method: "POST",
    body: { consignment_id: consignmentId },
    token,
  });
}

export function failDelivery(
  body: FailDeliveryRequest,
  token: string,
): Promise<DeliveryResultOut> {
  return apiFetch<DeliveryResultOut>("/api/v1/deliveries/fail", {
    method: "POST",
    body,
    token,
  });
}

/* ------------------------------------------------------------------ */
/* Analytics endpoints                                                 */
/* ------------------------------------------------------------------ */

export function getDashboard(
  token: string,
  post_office_id?: number | null,
  day?: string,
): Promise<DashboardOut> {
  const query = buildQuery({
    day,
    post_office_id: post_office_id ?? undefined,
  });
  return apiFetch<DashboardOut>(`/api/v1/analytics/dashboard${query}`, {
    token,
  });
}

/* ------------------------------------------------------------------ */
/* Geocoding endpoints                                                */
/* ------------------------------------------------------------------ */

export interface LocalityPreset {
  locality: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

export interface ReverseGeocodeOut {
  locality: string;
  city: string;
  state: string;
  pincode: string;
  display_name: string;
  latitude: number;
  longitude: number;
  source: string;
}

export interface ForwardGeocodeOut {
  latitude: number;
  longitude: number;
  source: string;
  is_geocoded: boolean;
}

export function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeOut> {
  return apiFetch<ReverseGeocodeOut>(
    `/api/v1/geocoding/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
  );
}

export function listLocalities(): Promise<LocalityPreset[]> {
  return apiFetch<LocalityPreset[]>("/api/v1/geocoding/localities");
}

export function forwardGeocode(locality: string, city = "Nashik", pincode = ""): Promise<ForwardGeocodeOut> {
  const query = buildQuery({ locality, city, pincode });
  return apiFetch<ForwardGeocodeOut>(`/api/v1/geocoding/forward${query}`);
}

/* ------------------------------------------------------------------ */
/* Post Offices & Transit Bagging                                      */
/* ------------------------------------------------------------------ */

export function listPostOffices(): Promise<PostOfficeOut[]> {
  return apiFetch<PostOfficeOut[]>("/api/v1/post-offices");
}

export interface UserRegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
  role?: Role;
}

export function registerUser(payload: UserRegisterRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/v1/auth/register", {
    method: "POST",
    body: payload,
  });
}

export function listMySent(token?: string): Promise<ConsignmentBrief[]> {
  return apiFetch<ConsignmentBrief[]>("/api/v1/consignments/my-sent", { token });
}

export function listMyReceived(token?: string): Promise<ConsignmentBrief[]> {
  return apiFetch<ConsignmentBrief[]>("/api/v1/consignments/my-received", { token });
}

export interface OutgoingGroup {
  destination_post_office: PostOfficeBrief;
  consignment_count: number;
  total_weight_grams: number;
  consignments: ConsignmentBrief[];
}

export interface DispatchBagRequest {
  origin_post_office_id: number;
  destination_post_office_id: number;
  consignment_ids: number[];
  custom_bag_number?: string;
}

export interface DispatchBagResponse {
  bag_number: string;
  origin_post_office: PostOfficeBrief;
  destination_post_office: PostOfficeBrief;
  dispatched_count: number;
  consignment_ids: number[];
  status: string;
}

export interface ReceiveBagRequest {
  destination_post_office_id: number;
  bag_number: string;
}

export interface ReceiveBagResponse {
  bag_number: string;
  destination_post_office: PostOfficeBrief;
  unbagged_count: number;
  consignment_ids: number[];
  status: string;
}

export interface IncomingBagGroup {
  bag_number: string;
  origin_post_office: PostOfficeBrief;
  destination_post_office: PostOfficeBrief;
  item_count: number;
  total_weight_grams: number;
  consignments: ConsignmentBrief[];
  status: string;
}

export function listIncomingBags(destinationPostOfficeId: number, token?: string): Promise<IncomingBagGroup[]> {
  return apiFetch<IncomingBagGroup[]>(
    `/api/v1/transit/incoming-bags?destination_post_office_id=${encodeURIComponent(destinationPostOfficeId)}`,
    { token },
  );
}

export function listOutgoingGroups(originPostOfficeId: number, token?: string): Promise<OutgoingGroup[]> {
  return apiFetch<OutgoingGroup[]>(
    `/api/v1/transit/outgoing-groups?origin_post_office_id=${encodeURIComponent(originPostOfficeId)}`,
    { token },
  );
}

export function dispatchBag(payload: DispatchBagRequest, token?: string): Promise<DispatchBagResponse> {
  return apiFetch<DispatchBagResponse>(
    "/api/v1/transit/dispatch-bag",
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function receiveBag(payload: ReceiveBagRequest, token?: string): Promise<ReceiveBagResponse> {
  return apiFetch<ReceiveBagResponse>(
    "/api/v1/transit/receive-bag",
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Convert minutes-from-midnight into a 12-hour clock label.
 * e.g. 615 -> "10:15 AM", 720 -> "12:00 PM", 0 -> "12:00 AM".
 */
export function minutesToLabel(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(total / 60);
  const mins = total % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${mins.toString().padStart(2, "0")} ${period}`;
}

/** Convert a slot's window into a compact label, e.g. "10:00 AM – 12:00 PM". */
export function slotWindowLabel(slot: SlotOut): string {
  return `${minutesToLabel(slot.start_minutes)} – ${minutesToLabel(
    slot.end_minutes,
  )}`;
}
