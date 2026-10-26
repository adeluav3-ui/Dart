# Dart — MVP Build Spec

Exported Oct 23, 2026 from the living spec doc. If the two disagree, ask Victor which is current.

## Overview

v1 is a mobile-first web app (PWA) that lets Sagamu residents order from local restaurants, supermarkets and pharmacies, pay upfront, and track delivery by a rider dispatched by an admin. It exists to prove one thing: that Sagamu produces enough repeat orders at a positive margin per order to justify a native app and expansion to similar towns.

**Three surfaces, one backend:**

- **Customer app** — browse, order, pay, track, rate
- **Vendor dashboard** — receive orders, accept, mark ready, manage menu
- **Rider + admin views** — admin assigns riders by hand; riders mark pickup and delivery

**In v1:** one city, single-vendor carts, online payment only, zone-based delivery fees, manual rider dispatch, landmark addresses.

**Not in v1:** native apps, auto-dispatch, live GPS tracking, promo codes, multi-vendor carts, scheduled orders, cash on delivery, prescription medicines.

**Proof of profitability (the gate to v2):** 30–50 orders/day held for 4 weeks, a positive margin on every order after rider pay, and a healthy 14-day reorder rate.

## Store types

Dart delivers from three kinds of store in v1, all through the same order flow; only the menu shape and prep time differ.

| Store type | Examples | What differs | v1 rule |
| --- | --- | --- | --- |
| Restaurant | Bukas, grills, shawarma spots | Items are built with option groups (protein, extras); prep time 10–45 min | Vendor accepts and sets prep time |
| Supermarket | Provision stores, minimarts | Items have a pack size ("1 L", "5 kg") and an optional stock count; prep is picking and packing, 5–15 min | Out-of-stock items are toggled off; if an item is missing after payment, the vendor marks it and the customer gets a partial refund to wallet |
| Pharmacy | Registered pharmacies and patent medicine stores | Over-the-counter products only; pack size shown | No prescription-only medicines in v1. Each pharmacy must show a valid PCN premises licence before going live |

**Partial refunds** are the one extra flow this adds: a supermarket or pharmacy order can be accepted with one or more items marked unavailable. The ledger records the refunded amount as an `adjustment`, and the customer sees the change on the order status screen.

## Tech stack and architecture

- **Frontend:** Next.js PWA + Tailwind, one codebase, routes split by role (`/`, `/vendor`, `/rider`, `/admin`), installable on Android home screens
- **Backend:** Supabase — Postgres with row-level security, phone OTP auth, Realtime (order status to every screen), Storage (food photos as WebP), Edge Functions (checkout, payment webhook, refunds), pg_cron (timeouts, daily payout list)
- **Payments:** Monnify — collections, payouts, refunds
- **SMS:** a Nigerian gateway such as Termii for OTP and vendor/rider alerts
- **Push:** Web push for status updates
- **Hosting:** Vercel or Netlify for the frontend

Anything involving money runs in an edge function, never in the client.

## Data model

Fifteen tables. Restaurant items need **option groups** (rice + protein + extra plantain) from day one.

| Table | Key fields | Notes |
| --- | --- | --- |
| `profiles` | id, phone, full_name, role (customer / vendor / rider / admin), created_at | One row per auth user; phone is the login |
| `vendors` | id, owner_id → profiles, name, slug, type (restaurant / supermarket / pharmacy), category, cover_photo_url, is_verified, is_open, avg_prep_mins, commission_rate, rating_avg, rating_count, payout_bank, payout_account_name | Ratings shown only when rating_count ≥ 5 |
| `vendor_hours` | vendor_id, day_of_week, opens_at, closes_at | Auto-close outside hours; manual toggle overrides |
| `menu_categories` | id, vendor_id, name, sort_order | "Rice", "Swallow", "Drinks", "Toiletries", "Pain relief" |
| `menu_items` | id, vendor_id, category_id, name, description, photo_url, base_price, pack_size, stock_qty (nullable), is_available, sort_order | is_available = sold-out toggle |
| `option_groups` | id, item_id, name, min_select, max_select | "Choose protein" (min 1, max 1), "Extras" (min 0, max 5) |
| `options` | id, group_id, name, price_delta, is_available | "Chicken +₦1,500", "Extra plantain +₦300" |
| `zones` | id, name, delivery_fee, rider_pay, is_active | Named areas of Sagamu; fee set per zone, not per km |
| `addresses` | id, user_id, zone_id, label, landmark, details, phone | Landmark is required, street is optional |
| `orders` | id, code, customer_id, vendor_id, zone_id, address snapshot, status, subtotal, delivery_fee, service_fee, total, commission_amount, rider_id, delivery_pin, prep_mins, created_at, paid_at, delivered_at | Copy prices and address into the order; never re-read live prices later |
| `order_items` | id, order_id, item_id, name_snapshot, unit_price, qty, options_snapshot (jsonb), line_total, is_unavailable | Snapshot so menu edits don't change past orders; is_unavailable drives partial refunds |
| `order_events` | id, order_id, from_status, to_status, actor_id, note, created_at | Append-only audit log; powers the status timeline and timeouts |
| `payments` | id, order_id, reference, provider, amount, status, raw_webhook (jsonb), created_at | One order can have several attempts; only one succeeds |
| `ledger_entries` | id, order_id, party_type (vendor / rider / platform / customer), party_id, amount, kind (earning / payout / refund / adjustment), settled_at | Sum per party = what is owed to them |
| `reviews` | id, order_id, customer_id, vendor_id, rating (1–5), comment, created_at | One per delivered order |

**Enforce in the database, not the UI:** prices and totals are recomputed server-side at checkout; status changes go through one function that validates the transition and writes `order_events`; row-level security limits vendors to their own orders and riders to orders assigned to them.

## Order state machine

Happy path: `pending_payment → paid → accepted → ready → picked_up → delivered`. Exits: `expired`, `cancelled`. Rider assignment is not a status — admin sets `rider_id` any time after `accepted`.

| Transition | Who triggers it | Guard |
| --- | --- | --- |
| pending_payment → paid | Monnify webhook | Signature valid, amount and reference match |
| pending_payment → expired | pg_cron | 30 minutes with no payment |
| paid → accepted | Vendor | Vendor is open; prep time chosen |
| paid → cancelled | Vendor reject, customer cancel, or pg_cron at 10 min | Triggers full refund |
| accepted → ready | Vendor | — |
| ready → picked_up | Assigned rider | Rider is the one assigned to this order |
| picked_up → delivered | Assigned rider | Customer's 4-digit PIN matches |

After `accepted`, cancellations are admin-only and logged as ledger adjustments. Timings are starting defaults.

## Payments and money flow

1. Client sends cart + address. The server recomputes every price from `menu_items` and `options`, adds the zone's delivery fee and the service fee, and creates the order as `pending_payment`.
2. Server creates a `payments` row with a structured reference `DT-{orderId8}-{timestamp6}` and initialises the Monnify transaction.
3. Customer pays by card, transfer or USSD on the Monnify checkout.
4. Monnify webhook hits an edge function that verifies the signature, checks amount and reference, and is idempotent. Only then does the order move to `paid` and the vendor get alerted.
5. Never mark an order paid from the client redirect. The redirect shows "Confirming payment…" until the webhook lands.

**Split on delivery** (written to `ledger_entries` when the order hits `delivered`):

| Party | Earns |
| --- | --- |
| Vendor | subtotal − commission |
| Rider | zone's rider_pay |
| Platform | commission + service fee + (delivery fee − rider_pay) |

**Settlement:** daily. Start with a payout list in admin sent manually; switch to automatic Monnify single transfers after two clean weeks.

**Refunds:** vendor rejection, vendor timeout, or customer cancel before acceptance = full refund, default to instant wallet credit, with a "refund to bank" option via Monnify's refund API. Partial refunds for unavailable items go to wallet. After pickup, refunds are an admin decision logged as `adjustment`.

## Customer app screens

Browsing needs no login; ask for the phone number only at checkout.

| Screen | What's on it | Notes |
| --- | --- | --- |
| Home | Store type tabs (Food, Supermarket, Pharmacy), stores open now, category chips, search, closed stores greyed below | Sort by open first, then rating, then prep time |
| Vendor page | Cover photo, verified badge, hours, avg prep time, rating (once ≥ 5 reviews), menu by category with photos, prices, pack sizes | Sold-out items stay visible but disabled |
| Item sheet | Photo, description, option groups (required first), quantity, running price | Block "Add" until required options are picked |
| Cart | Items with options, edit quantity, subtotal | One vendor per cart; adding from another asks to clear |
| Checkout | Phone OTP (first time), zone + landmark + details, fee breakdown, Pay button | Subtotal, delivery fee and service fee as separate lines |
| Order status | Live timeline, estimated time, rider name + call button, delivery PIN | Real time; survives closing and reopening the tab |
| Orders | Past orders, Reorder, wallet balance | Reorder rebuilds the cart at today's prices |
| Rate order | 1–5 stars + optional comment | One tap to skip |

## Vendor dashboard

Three taps per order: accept, mark ready, hand over. Design for a busy buka owner or shop attendant on a cheap Android phone.

| Screen | What's on it | Notes |
| --- | --- | --- |
| Orders board | New / Preparing / Ready. Each card: order code, items with options in large text, time since paid | New orders ring loudly and repeat until touched |
| Accept / reject | Accept with prep time (10 / 20 / 30 / 45 min); reject with reason; supermarkets and pharmacies can mark single items unavailable | Rejection = automatic refund |
| Menu manager | Toggle items/options available; open/closed switch | Price and photo edits go through admin in v1 |
| Earnings | Today's orders, amount owed, past payouts | |

**Alert escalation:** in-app sound + web push on payment → SMS at 2 min if not accepted → red on admin board at 5 min → auto-reject and refund at 10 min.

## Rider and admin views

| Rider screen | What's on it |
| --- | --- |
| My jobs | Assigned orders in pickup order: vendor + call, customer zone + landmark + call, order code |
| Job actions | "Picked up" (only after vendor marks ready) and "Confirm delivery" (requires customer PIN) |
| Earnings | Trips today, amount owed, past payouts |

| Admin screen | What it does |
| --- | --- |
| Live board | Every active order with a timer per status; amber then red when stuck; one click to call |
| Dispatch | Assign / reassign riders after the vendor accepts; see each rider's load |
| Vendors | Create vendor, set type, upload photos, build menu and option groups, set commission, mark verified |
| Zones | Name zones, set delivery fee and rider pay |
| Riders | Add rider, ID details, active / inactive |
| Money | Daily payout list, refunds, manual adjustments with a required note |
| Metrics | Orders/day, reorder rate, margin, delivery time, acceptance, refund rate |

## Pricing

margin = subtotal × commission_rate + service_fee + (delivery_fee − rider_pay) − payment_fee

All fee values are set per zone / in config by admin. **Do not hard-code fee amounts** — they are not decided yet.

## Sagamu-specific UX

- Landmark-first addresses: zone dropdown + required landmark + optional details; saved for reorders
- Zones, not GPS: no maps API in v1
- Light on data: WebP photos ~100 KB, lazy loading, works on weak 3G
- Phone-number login: OTP by SMS, no email or password
- Ratings hidden until 5 reviews; "New" badge instead

## Build order

1. **Week 1 — Foundation:** schema + RLS, phone OTP login, vendor + menu admin, photo upload
2. **Week 2 — Ordering:** browse + item sheet, cart + checkout, Monnify + webhook, status timeline
   - **Gate:** a real paid order runs end to end before starting week 3
3. **Week 3 — Operations:** vendor board + alerts, rider view + PIN, dispatch board, timeouts + refunds
4. **Week 4 — Pilot:** ledger + payout list, 20 real test orders, fix what breaks, launch at OOUTH
