# PO Tracker – daily sales team scorecard

An installable app (works offline) for running the team plan from the **"Winning together under the new
Performance Obligations"** kick-off deck. It tracks the Sales Head and three direct reports every day
against the PO measures: **Reach** (pipeline), **Convert** (bookings) and **Retain** (collections).

**Web link:** https://vinuphilipos-boop.github.io/Project/po-tracker/

## Team and targets (pre-loaded, editable in Settings)

The tracker covers **Q3 (Oct–Dec 2026) and Q4 (Jan–Mar 2027)** of FY 2026-27 only.

| Owner | Target Q3+Q4 | Q3 | Q4 |
|---|---|---|---|
| Vinu (Sales Head) | Rs 30 Cr | 15 | 15 |
| Umesh Gour | Rs 6 Cr | 3 | 3 |
| Santhosh Kumar | Rs 6 Cr | 3 | 3 |
| Mithunn Kumar | Rs 6 Cr | 3 | 3 |
| **Team** | **Rs 48 Cr** | 24 | 24 |

The Q3/Q4 split starts equal; type your own figures in **Settings**. Enter **Q3 booked before tracker** (orders
from 1 Oct to the day before the tracker start date) so Q3 progress is right. Any Q3 shortfall rolls into Q4.

## The LT philosophy: Reach → Convert → Retain

**Reach – Master Plan.** Each owner picks high-potential customers (consultants, architects, contractors,
developers, Govt/PSU…) from their SOM (Serviceable Obtainable Market) and moves them through five stages:

| Stage | Meaning |
|---|---|
| Sprouting | Does not know LT yet |
| Seeding | Introduced to LT |
| Budding | Convinced on LT |
| Flowering | Has specified / recommended LT |
| Ripening | Repeatedly specifies / recommends LT |

Moving customers up the stages produces **LT qualified projects**. It takes face-to-face work, so 4 customer
visits a day are mandatory. The tools are in the online **LT Deck** (corporate video, product videos,
credentials), and the app records which LT Deck content was shown in every meeting.

**Convert – Project navigation.** Projects move Identified → LT specified → Offer submitted → Negotiation → Won / Lost.

**Retain.** Execute the order and collect 100% on the due date.

## Screens

| Tab | What it does |
|---|---|
| **Scorecard** | Six daily indicators per owner in Green / Amber / Red: F2F visits, pipeline vs remaining, booking vs pro-rata, collections, submissions FTR, **LT Deck use**. Escalation step, 12-day history, Captain's check list, joint visits, quarter in numbers. |
| **Huddle & Close** | Morning huddle in three blocks – **Reach** (stage counts, accounts needing attention, today's visit plan picked from the Master Plan, 4 or more), **Convert** (negotiation deals with decision-maker / competitor / price / today's move, offers awaiting decision, stuck projects) and **Retain** (collections due, execution issues). Evening close logs each meeting against a Master Plan account with the LT Deck content shown and any stage change; visits and new projects are counted from these. |
| **Master Plan** | Accounts on a Sprouting → Ripening board, with potential, days in stage, last meeting, next action, ◀ ▶ to move stage. Team summary by owner, stage moves, accounts not met in 30+ days, LT Deck usage. |
| **Projects** | Project navigation, linked to the Master Plan account it came through; Won books the order. |
| **Orders**, **Collections**, **Offers** | Order ledger, due list, submissions with First Time Right. |
| **Saturday review** | Master Plan, LT Deck, Sales, Projects, Pipeline, Collections, Visits, Submissions per owner with a named fix. |
| **Work ethic** | Evidence log for the 20% of increment. |
| **Settings** | Targets, bands (incl. LT Deck use 80% Green / 50% Amber), follow-up gap, backup and CSV exports. |

## How the numbers are worked out

- **Quarter target** = Q target + any Q3 shortfall carried into Q4.
- **Booking vs pro-rata** = booked this quarter ÷ (quarter target × working days elapsed ÷ working days in quarter).
- **Pipeline cover** = qualified open pipeline ÷ remaining target (Green 5×, Amber 4–5×, Red below 4×).
- **F2F visits** = average over the last 6 working days. A missing evening close counts as zero visits.
- **Collections** = oldest unpaid due: Green none late, Amber up to 15 days, Red 15+ days (or private 30+).
- **LT Deck use** = share of meetings in the last 6 working days where LT Deck content was shown.
- **Submissions** = slips this week (late, still pending past due, or not FTR): 0 Green, 1 Amber, 2+ Red.
- **Escalation**: Amber → Step 1; Red, or Amber for 2 working weeks → Step 2; Red for 2 working weeks →
  Step 3; booking Red in the last week of the quarter → Step 4.

The bands are the deck's starting points and can be tuned in Settings.

## Team members on their own phones

Everything is stored in the browser of the device that uses it (no server). The Sales Head's device is the
master tracker. Each team member can install the app, set **Settings → This device belongs to** to
their name, fill the evening close and tap **Send as message** (WhatsApp etc.). The Sales Head pastes the
message into **Huddle & Close → Import** and the visits, close details and orders load automatically.
Collections reported in a message still need to be recorded against the due in **Collections**.

Use **Settings → Export backup** regularly.

## Releasing updates

Bump `CACHE_VERSION` in `sw.js` when app files change.
