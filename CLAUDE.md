# GoCart

GoCart is a local delivery app for Sagamu, Ogun State, Nigeria: customers order from restaurants, supermarkets and pharmacies, pay online, and a rider brings it to their landmark. This repo is the MVP. Its only job is to prove that orders repeat at a positive margin. Ship the simplest thing that does that.

## Read first

- `docs/build-spec.md` — the full spec: data model, order state machine, money flow, screens, build order. **The spec wins** over anything else in this repo.
- `docs/design/*.dc.html` — the approved screen designs, as HTML markup with inline styles. Read them for layout, spacing, colours and copy. They use a custom runtime (`support.js`, `<x-dc>`, `{{holes}}`), so do not run them or copy that runtime — rebuild each screen as React + Tailwind.
- `public/brand/gocart-logo.svg`, `public/brand/gocart-symbol.svg` — the logo and symbol. Use the `<Logo>` component at `src/components/ui/Logo.tsx` for all logo usage.

| Design file | Screen |
| --- | --- |
| `Main.dc.html` | Customer home |
| `Vendor.dc.html` | Vendor page (menu) |
| `Item.dc.html` | Item options sheet |
| `Checkout.dc.html` | Checkout |
| `Tracking.dc.html` | Order status |
| `VendorBoard.dc.html` | Vendor orders board |
| `RiderJob.dc.html` | Rider current job |
| `LogoTarget.dc.html` | Logo and wordmark usage |

The home design shows restaurants only. Per the spec, add store type tabs (Food, Supermarket, Pharmacy) above the category chips, using the same chip style.

## Stack

- Next.js (App Router) + TypeScript + Tailwind, built as an installable PWA
- Supabase: Postgres + RLS, phone OTP auth, Realtime, Storage, Edge Functions, pg_cron
- Monnify for payments, payouts and refunds
- Termii (or similar) for SMS
- Routes by role: `/` customer, `/vendor`, `/rider`, `/admin`

## Brand tokens

Put these in `tailwind.config` and use the names, never raw hex in components.

| Token | Hex | Use |
| --- | --- | --- |
| `brand` | `#0B7A47` | Primary buttons, active states, links |
| `brand-dark` | `#086138` | Hover / pressed |
| `brand-ink` | `#0A4F30` | Text on brand-tint |
| `brand-tint` | `#E7F4EC` | Trust banner, secondary buttons |
| `brand-bright` | `#3DDC84` | On dark backgrounds only |
| `pepper` | `#F26A1B` | Wheel accents in logo only — not for buttons |
| `ink` | `#15171A` | Primary text, dark headers |
| `ink-2` | `#5B6168` | Secondary text |
| `line` | `#E6E8EB` | Borders, dividers |
| `surface` | `#F3F4F2` | Chips, inputs, quantity steppers |
| `canvas` | `#F6F7F5` | Page background on checkout / vendor / rider |
| `photo` | `#EDE6DA` | Photo placeholder background |
| `warn` / `warn-tint` | `#8A4B08` / `#FDF0E1` | "Required" badges, new-order alert |
| `danger` | `#B42318` | Reject / destructive |
| `star` | `#F5A524` | Rating star |

Fonts (Google Fonts): **Bricolage Grotesque** 700/800 for headings and the wordmark; **Plus Jakarta Sans** 400–700 for everything else.

Shape: cards and buttons `rounded-2xl` (16px), chips fully rounded, primary buttons 56px tall, every touch target at least 44px. Icons are 2px-stroke outline icons (lucide-react fits); no emoji.

Logo: use the `<Logo>` component. variant `full` on white/light, `white` on brand green, `dark` on ink #15171A, `symbol`/`symbol-white` where space is tight. Never recolour or stretch.

## Rules that must not be broken

1. **Money only moves server-side.** Prices, fees and totals are recomputed in an edge function at checkout; the client total is display only.
2. **An order is paid only when the Monnify webhook says so** — signature verified, amount and reference matched, handled idempotently. Never trust the payment redirect.
3. **Every status change goes through one Postgres function** that checks the transition against the state machine in the spec and writes `order_events`. No direct `update orders set status`.
4. **RLS on every table.** Vendors see only their orders; riders only orders assigned to them; customers only their own.
5. **Snapshot at order time.** Item names, prices, options and the address are copied into the order.
6. **Delivery requires the customer's 4-digit PIN.**
7. **No hard-coded fees.** Delivery fee and rider pay live in `zones`; service fee and commission in config / `vendors`. The amounts are not decided yet.
8. **No prescription medicines.** Pharmacies sell over-the-counter products only in v1.

## Conventions

- Money is stored as integer kobo; display as `₦3,500` with `Intl.NumberFormat('en-NG')`, no decimals.
- Times shown in Africa/Lagos.
- Addresses = zone + required landmark + optional details. No maps or GPS.
- Phone numbers are Nigerian (`+234`); accept `080…` input and normalise.
- Images: WebP, ~100 KB, lazy loaded. Assume a slow 3G connection.
- Ratings are hidden until a vendor has 5 reviews; show a "New" badge instead.
- Order codes use `GC-` prefix (e.g. `GC-1000`). Existing orders with `SD-` codes are still valid — lookups match the stored value exactly.
- Payment references use `GC-{orderId8}-{timestamp36}` format.

## Out of scope for v1

Native apps, auto-dispatch, live GPS, promo codes, multi-vendor carts, scheduled orders, cash on delivery, prescription medicines. Don't build them, and don't add abstractions "for later".

## Build order

Follow the four weeks in the spec. Do not start operations work (week 3) until a real paid order has gone through the webhook and appeared on a vendor screen.

## Working with Victor

Victor is a solo founder and builds with AI assistance. Before each piece of work, state the plan in a few lines; after it, say what changed and how to test it. Ask before adding a dependency, changing the schema in a way the spec doesn't describe, or touching anything that handles money.
