export type UserRole = 'customer' | 'vendor' | 'rider' | 'admin'
export type VendorType = 'restaurant' | 'supermarket' | 'pharmacy'
export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'accepted'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'
  | 'expired'
export type LedgerParty = 'vendor' | 'rider' | 'platform' | 'customer'
export type LedgerKind = 'earning' | 'payout' | 'refund' | 'adjustment' | 'topup'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface Profile {
  id: string
  phone: string | null
  full_name: string | null
  role: UserRole
  roles: string[]
  last_dashboard: string | null
  marketing_emails: boolean
  created_at: string
}

export type ApplicationKind = 'vendor' | 'rider'
export type ApplicationStatus = 'submitted' | 'contacted' | 'approved' | 'rejected'

export interface Application {
  id: string
  user_id: string
  kind: ApplicationKind
  status: ApplicationStatus
  data: Record<string, unknown>
  admin_note: string | null
  created_at: string
  decided_at: string | null
}

export interface Vendor {
  id: string
  owner_id: string | null
  zone_id: string | null
  area_id: string | null
  name: string
  slug: string
  type: VendorType
  category: string | null
  cover_photo_url: string | null
  description: string | null
  is_verified: boolean
  is_open: boolean
  avg_prep_mins: number
  commission_rate: number
  rating_avg: number
  rating_count: number
  payout_bank: string | null
  payout_bank_code: string | null
  payout_account_name: string | null
  payout_account_no: string | null
  created_at: string
  lat: number | null
  lng: number | null
}

export interface VendorHours {
  id: string
  vendor_id: string
  day_of_week: number
  opens_at: string
  closes_at: string
}

export interface MenuCategory {
  id: string
  vendor_id: string
  name: string
  sort_order: number
}

export type MenuItemStatus = 'draft' | 'in_review' | 'live' | 'rejected'

export interface MenuItem {
  id: string
  vendor_id: string
  category_id: string | null
  name: string
  description: string | null
  photo_url: string | null
  base_price: number
  pack_size: string | null
  stock_qty: number | null
  is_available: boolean
  sort_order: number
  status: MenuItemStatus
  review_note: string | null
  is_sold_out: boolean
  pending_price: number | null
  pending_photo_url: string | null
}

export interface MenuTemplate {
  id: string
  store_type: VendorType
  pack_name: string
  category_name: string
  item_name: string
  description: string | null
  default_option_groups: unknown | null
  sort_order: number
}

export interface OptionGroup {
  id: string
  item_id: string
  name: string
  min_select: number
  max_select: number
  sort_order: number
}

export interface Option {
  id: string
  group_id: string
  name: string
  price_delta: number
  is_available: boolean
  sort_order: number
}

export type AreaStatus = 'active' | 'coming_soon'

export interface Zone {
  id: string
  name: string
  is_active: boolean
}

export interface Area {
  id: string
  zone_id: string | null
  name: string
  district: string | null
  aliases: string[]
  lat: number | null
  lng: number | null
  radius_m: number
  accuracy_m: number | null
  pin_saved_at: string | null
  pin_saved_by: string | null
  gate_pickup: boolean
  status: AreaStatus
  is_active: boolean
  sort_order: number
  created_at: string
}

export type DeliverySpotLabel = 'Home' | 'Hostel' | 'Work' | 'Other'

export interface DeliverySpot {
  id: string
  user_id: string
  label: DeliverySpotLabel
  custom_label: string | null
  lat: number
  lng: number
  area_id: string | null
  description: string | null
  is_default: boolean
  created_at: string
}

export interface DeliveryPricingSettings {
  id: number
  base_fare_kobo: number
  per_km_kobo: number
  min_fare_kobo: number
  round_to_kobo: number
  rider_extra_kobo: number
  gocart_extra_kobo: number
  max_distance_m: number
  daily_google_call_cap: number
  updated_at: string
}

export interface AreaPinHistory {
  id: string
  area_id: string
  lat: number
  lng: number
  accuracy_m: number | null
  saved_at: string
  saved_by: string | null
  replaced_at: string
}

export interface AreaRequest {
  id: string
  area_name: string
  user_id: string | null
  email: string | null
  created_at: string
}

export interface CoverageArea {
  id: string
  name: string
  polygon: { type: 'Polygon'; coordinates: number[][][] } | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CoverageWaitlistEntry {
  id: string
  email: string | null
  lat: number | null
  lng: number | null
  created_at: string
  user_id: string | null
}

export interface FareLevel {
  id: string
  name: string
  okada_price: number
  rider_pay: number
  delivery_fee: number
  sort_order: number
}

export interface ZoneFare {
  id: string
  zone_a: string
  zone_b: string
  fare_level_id: string | null
  is_serviceable: boolean
}

export interface Rider {
  id: string
  is_active: boolean
  is_available: boolean
  lat: number | null
  lng: number | null
  location_accuracy: number | null
  location_updated_at: string | null
  notes: string | null
  bike_plate: string | null
  payout_bank: string | null
  payout_bank_code: string | null
  payout_account_name: string | null
  payout_account_no: string | null
  created_at: string
}

export interface VendorRider {
  id: string
  vendor_id: string
  rider_id: string
  sort_order: number
}

export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth_key: string
  created_at: string
}

export interface Address {
  id: string
  user_id: string
  zone_id: string | null
  area_id: string | null
  label: string | null
  landmark: string
  details: string | null
  phone: string | null
  is_default: boolean
  created_at: string
}

export interface AppSetting {
  key: string
  value: string
  updated_at: string
}

export type SupportTicketStatus = 'open' | 'resolved' | 'closed'

export interface SupportTicket {
  id: string
  user_id: string | null
  order_id: string | null
  subject: string
  body: string
  status: SupportTicketStatus
  admin_note: string | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  code: string
  customer_id: string
  vendor_id: string
  zone_id: string
  area_id: string | null
  area_name: string | null
  address_zone: string
  address_landmark: string
  address_details: string | null
  address_phone: string
  status: OrderStatus
  subtotal: number
  delivery_fee: number
  service_fee: number
  total: number
  commission_amount: number
  rider_pay: number
  rider_id: string | null
  delivery_pin: string
  prep_mins: number | null
  created_at: string
  paid_at: string | null
  accepted_at: string | null
  ready_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  is_gate_pickup: boolean
  gate_arrived_at: string | null
  gate_no_show: boolean
  gate_no_show_at: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  pickup_distance_m: number | null
  rider_assigned_at: string | null
  pin_lat: number | null
  pin_lng: number | null
  distance_m: number | null
  distance_source: string | null
  okada_fare_kobo: number | null
  rider_pay_kobo: number | null
  delivery_fee_kobo: number | null
  pricing_snapshot: Record<string, unknown> | null
  wallet_applied_kobo: number
}

export interface OrderItem {
  id: string
  order_id: string
  item_id: string | null
  name_snapshot: string
  unit_price: number
  qty: number
  options_snapshot: OptionSnapshot[]
  line_total: number
  is_unavailable: boolean
}

export interface OptionSnapshot {
  group_name: string
  option_name: string
  price_delta: number
}

export interface OrderEvent {
  id: string
  order_id: string
  from_status: OrderStatus | null
  to_status: OrderStatus
  actor_id: string | null
  note: string | null
  created_at: string
}

export interface Payment {
  id: string
  order_id: string | null
  reference: string
  provider: string
  amount: number
  status: PaymentStatus
  type: 'order' | 'wallet_topup'
  topup_user_id: string | null
  raw_webhook: Record<string, unknown> | null
  created_at: string
}

export interface LedgerEntry {
  id: string
  order_id: string | null
  party_type: LedgerParty
  party_id: string | null
  amount: number
  kind: LedgerKind
  note: string | null
  settled_at: string | null
  created_at: string
}

export interface Review {
  id: string
  order_id: string
  customer_id: string
  vendor_id: string
  rating: number
  comment: string | null
  created_at: string
}

export type PayoutRequestStatus = 'pending' | 'approved' | 'rejected'

export interface PayoutRequest {
  id: string
  user_id: string
  amount: number
  bank_name: string
  account_no: string
  account_name: string
  status: PayoutRequestStatus
  note: string | null
  created_at: string
}


// Cart types (client-only)
export interface CartItem {
  item: MenuItem
  qty: number
  selectedOptions: {
    group: OptionGroup
    options: Option[]
  }[]
  lineTotal: number
}

export interface Cart {
  userId: string | null
  vendorId: string
  vendorSlug: string
  vendorName: string
  vendorZoneId: string | null
  items: CartItem[]
}
