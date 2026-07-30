# Skelora Procurement Simulator

A full procure-to-pay training console for students — draft a Purchase
Requisition, run a competitive RFQ, negotiate with vendors, issue and amend a
Purchase Order, receive goods across multiple shipments, verify a three-way
match, and close the case, with an instructor console for grading a class.
Everything runs entirely in your browser — there is no server, and no data
ever leaves the device.

## Getting Started

1. Unzip this folder.
2. Open `index.html` in any modern browser (Chrome, Edge, or Firefox). No
   installation, build step, or internet connection is required after the
   first load — the only thing that needs the internet is the optional
   Google Fonts styling, which falls back to a system font if unavailable.
3. Create a profile the first time you open it (Student ID + password) and
   sign in from then on. Profiles and case data live in that browser only —
   a different browser or device won't see them, so use the same one for a
   whole class/session, or use **Settings → Export My Data** to back up and
   move cases between devices.

## Roles

**Student** — works a procurement case from end to end, one role at a time
(Purchasing Officer, Manager, Warehouse, Accounts, Finance), exactly as a
real procurement team would divide the work.

**Instructor / Admin** — select this at registration and enter the access
code `SKELORA-STAFF-2026`. Instructors get a separate console instead of the
student dashboard: a class-wide overview, the ability to open and grade any
student's case, and full control over the vendor directory and budget codes.

## The Workflow

Each case walks through 13 stages, matching a real procure-to-pay cycle:

1. **Department Needs Item** — the triggering business need (given as a
   scenario; everything after this is created by the student).
2. **Purchase Requisition** — one or more line items, budget code,
   priority, and justification.
3. **Manager Approval** — approve, send back for revision, or reject.
   Requisitions above ₹5,00,000 also require a Senior Management sign-off.
4. **Request for Quotation** — invite at least 3 vendors for competitive
   bidding.
5. **Receive Quotations** — record each vendor's price per line item, lead
   time, and payment terms.
6. **Quotation Comparison** — a weighted scoring model (price / delivery /
   payment terms) ranks the vendors. You can also send one counter-offer to
   any vendor here before finalising the comparison.
7. **Select Vendor** — confirm the winner with a written justification.
8. **Create Purchase Order** — issue the PO. An issued PO can later be
   **amended** (price, quantity, delivery date, terms) with a reason and a
   re-authorising signature, right up until the invoice is verified.
9. **Vendor Delivery** — log shipments as they arrive; a single PO can be
   fulfilled across several partial shipments.
10. **Goods Receipt Note** — inspect and accept each shipment individually,
    recording any rejections.
11. **Invoice Verification** — a line-by-line three-way match against the
    PO and the cumulative goods received, with Approve / Hold / Dispute.
12. **Payment Request** — raise payment against the verified invoice.
13. **Purchase Closed** — a full audit trail, a downloadable case summary
    (CSV), and a printable Certificate of Completion.

## For Instructors

- **Console → Students**: drill into any student's cases, open a read-only
  document trail for any case, and record a score and written feedback.
- **Console → Master Data**: add or deactivate vendors and budget codes
  from the **Vendors** and **Budgets** pages.
- **Reports**: case funnel, average days-to-close, and rejection rate,
  class-wide.
- Vendor **scorecards** (on-time delivery %, quality pass %) are computed
  automatically from closed cases — no manual entry needed.

## A Few Notes

- **Security**: passwords are hashed (not stored in plain text) and
  accounts lock temporarily after repeated failed attempts, but this is
  still a fully client-side app with no server — treat it as professional
  hygiene for a training tool, not the same guarantee as a real backend.
- **Signatures** are optional on approval/authorisation steps — draw with a
  mouse, stylus, or touch; the typed name field is what's actually required.
- **Backups**: use Settings → Export/Import to move a student's cases
  between browsers or devices, or to keep a semester's records.
- **Glossary**: the "? Help" button in the top bar explains every
  procurement term used in the app (PR, RFQ, 3-way match, GST, etc.).

## What's Deliberately Out of Scope

This is a training simulator, not a production ERP. A few things it does
not attempt: multi-currency, real payment processing, real email/vendor
portals (quotations are entered by the student, playing the vendor's part),
and a full general ledger. If your course needs any of these, treat this as
a starting point rather than a finished product.
