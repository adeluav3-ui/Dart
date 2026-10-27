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
export type LedgerKind = 'earning' | 'payout' | 'refund' | 'adjustment'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface Profile {
  id: string
  phone: string | null
  full_name: string | null
  role: UserRole
  created_at: string
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
  payout_account_name: string | null
  payout_account_no: string | null
  created_at: string
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
  status: AreaStatus
  sort_order: number
  created_at: string
}

export interface AreaRequest {
  id: string
  area_name: string
  user_id: string | null
  email: string | null
  created_at: string
}

export interface ZoneFare {
  id: string
  zone_a: string
  zone_b: string
  delivery_fee: number
  rider_pay: number
  is_serviceable: boolean
}

export interface Rider {
  id: string
  is_active: boolean
  notes: string | null
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
  created_at: string
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
  order_id: string
  reference: string
  provider: string
  amount: number
  status: PaymentStatus
  raw_webhook: Record<string, unknown> | null
  created_at: string
}

export interface LedgerEntry {
  id: string
  order_id: string
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

export interface VendorApplication {
  id: string
  user_id: string
  business_name: string
  business_type: VendorType
  area: string
  phone: string
  status: string
  created_at: string
}

export interface RiderApplication {
  id: string
  user_id: string
  full_name: string
  phone: string
  area: string
  has_bike: boolean
  status: string
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
  vendorId: string
  vendorName: string
  vendorZoneId: string | null
  items: CartItem[]
}
