# PO Tracker – daily sales team scorecard

An installable app (works offline) for running the team plan from the **"Winning together under the new
Performance Obligations"** kick-off deck. It tracks the Sales Head and three direct reports every day
against the PO measures: **Reach** (pipeline), **Convert** (bookings) and **Retain** (collections).

**Web link:** https://vinuphilipos-boop.github.io/Project/po-tracker/

## Team and targets (pre-loaded, editable in Settings)

| Owner | FY target |
|---|---|
| Sales Head (me) | Rs 30 Cr |
| Umesh Gour | Rs 6 Cr |
| Santhosh Kumar | Rs 12 Cr |
| Mithunn Kumar | Rs 12 Cr |
| **Team** | **Rs 60 Cr** |

Targets are treated as financial-year targets (Q1 Apr–Jun … Q4 Jan–Mar), split equally per quarter until
you enter the Q-wise targets. Enter **Booked before tracker** for each quarter so the carry-forward is right.

## Screens

| Tab | What it does (deck slide) |
|---|---|
| **Scorecard** | The five lead indicators per owner in Green / Amber / Red (slide 10), the escalation step (slide 11), a 12-day history strip, the Captain's check list of reds for tomorrow's huddle (slide 7), your joint-visit commitment (slide 13) and "your quarter in numbers" (slide 6). |
| **Huddle & Close** | Morning huddle – collections due, Ripening deals (decision-maker, competitor, price position, today's move), visit plan, help needed (slide 8). Evening close – visits, new projects, collections, orders, spec approvals, POs, offers FTR, tomorrow's first move. |
| **Pipeline** | Master Plan with stages Sprouting → Ripening, qualified flag, deals stuck 14+ days, Won / Lost. Coverage against 5× the remaining target. |
| **Orders** | Order ledger; drives booking vs pro-rata target. |
| **Collections** | Due list by customer and due date, part payments, days late; private customers over 30 days are always Red. |
| **Offers** | Offers / BOQs / submissions with due date, sent date and First Time Right. |
| **Saturday review** | Sales, Orders, Pipeline, Collections, Visits and Submissions for each owner, with a named fix per gap (slide 9). Printable. |
| **Work ethic** | Evidence log for the 20% of increment: Work Ethic Principles, LT Values, LT Ethos (slide 12). |
| **Settings** | Targets, opening bookings, average order value, working days, holidays, scorecard bands, backup. |

## How the numbers are worked out

- **Quarter target** = Q target + shortfall carried from earlier quarters of the FY.
- **Booking vs pro-rata** = booked this quarter ÷ (quarter target × working days elapsed ÷ working days in quarter).
- **Pipeline cover** = qualified open pipeline ÷ remaining target (Green 5×, Amber 4–5×, Red below 4×).
- **F2F visits** = average over the last 6 working days. A missing evening close counts as zero visits.
- **Collections** = oldest unpaid due: Green none late, Amber up to 15 days, Red 15+ days (or private 30+).
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
