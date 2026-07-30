/* ==========================================================================
   Skelora Procurement Simulator — Reference / Master Data
   This file holds only *master data* (things a real ERP would ship with,
   like an approved vendor list or a budget-code list) and the department
   "need" scenarios that kick off each case. It never contains any of the
   actual procurement figures (prices, quotes, PO totals, etc.) — those are
   entered by the student while working the case.
   ========================================================================== */

const VENDOR_DIRECTORY = [
  { id: "V-101", name: "Cochin Office Systems Pvt Ltd", category: "IT Equipment", contact: "Rekha Menon", email: "sales@cochinoffice.example", phone: "0484-2233445", city: "Kochi" },
  { id: "V-102", name: "Kairali Traders", category: "Office Supplies", contact: "Suresh Nair", email: "orders@kairalitraders.example", phone: "0471-2244556", city: "Thiruvananthapuram" },
  { id: "V-103", name: "Malabar Steel & Alloys", category: "Raw Materials", contact: "Anitha Raj", email: "quotes@malabarsteel.example", phone: "0495-2334455", city: "Kozhikode" },
  { id: "V-104", name: "Spice Coast Furnishings", category: "Furniture", contact: "Thomas Varghese", email: "info@spicecoastfurnish.example", phone: "0484-2556677", city: "Kochi" },
  { id: "V-105", name: "Periyar Industrial Supplies", category: "Industrial Equipment", contact: "Manoj Pillai", email: "sales@periyarindustrial.example", phone: "0484-2667788", city: "Aluva" },
  { id: "V-106", name: "Backwater Electricals", category: "Electrical", contact: "Deepa Kurian", email: "contact@backwaterelec.example", phone: "0477-2445566", city: "Alappuzha" },
  { id: "V-107", name: "Highrange Packaging Co.", category: "Packaging", contact: "Vinod Thomas", email: "orders@highrangepack.example", phone: "04868-233445", city: "Munnar" },
  { id: "V-108", name: "Coastal Stationery Mart", category: "Stationery", contact: "Priya Balan", email: "sales@coastalstationery.example", phone: "0484-2778899", city: "Ernakulam" },
  { id: "V-109", name: "Anamudi Logistics Equipment", category: "Industrial Equipment", contact: "Rahul Chacko", email: "info@anamudilog.example", phone: "0486-2223344", city: "Idukki" },
  { id: "V-110", name: "Kuttanad Agro Machinery", category: "Industrial Equipment", contact: "Sajitha Kumari", email: "sales@kuttanadagro.example", phone: "0477-2665544", city: "Kuttanad" }
];

const BUDGET_CODES = [
  { code: "OPEX-IT-01", label: "OPEX-IT-01 — IT & Systems", allocatedBudget: 1500000 },
  { code: "OPEX-ADM-02", label: "OPEX-ADM-02 — Administration", allocatedBudget: 800000 },
  { code: "OPEX-FAC-03", label: "OPEX-FAC-03 — Facilities & Maintenance", allocatedBudget: 1000000 },
  { code: "CAPEX-PRD-04", label: "CAPEX-PRD-04 — Production Capital", allocatedBudget: 2500000 },
  { code: "OPEX-MKT-05", label: "OPEX-MKT-05 — Marketing", allocatedBudget: 600000 },
  { code: "OPEX-HR-06", label: "OPEX-HR-06 — Human Resources", allocatedBudget: 500000 }
];

/* Gate for registering an Instructor/Admin profile — a simple UI-level gate
   (this is a client-only app with no server, so treat this as classroom
   convention rather than real access control). */
const INSTRUCTOR_ACCESS_CODE = "SKELORA-STAFF-2026";

const SECURITY_QUESTIONS = [
  "What was the name of your first school?",
  "What is your favourite teacher's name?",
  "What city were you born in?",
  "What was the name of your first pet?",
  "What is your mother's hometown?"
];

const UOM_LIST = ["Nos", "Units", "Sets", "Kg", "Litres", "Boxes", "Reams", "Meters", "Tonnes"];

const PAYMENT_TERMS = ["Advance (100%)", "50% Advance / 50% on Delivery", "Net 15", "Net 30", "Net 45", "Cash on Delivery"];

const DELIVERY_TERMS = ["Ex-Works", "FOB (Free on Board)", "CIF (Cost, Insurance, Freight)", "DDP (Delivered Duty Paid)", "Door Delivery"];

const PRIORITY_LEVELS = ["Low", "Medium", "High", "Urgent"];

const GST_RATES = [0, 5, 12, 18, 28];
const DEFAULT_GST_RATE = 18;

/* PR value above this triggers a mandatory Senior Management sign-off
   during the Manager Approval stage — a standard governance control in
   real procurement policy. */
const SENIOR_APPROVAL_THRESHOLD = 500000;

/* Heuristic favourability-to-buyer scoring for payment terms, used by the
   weighted vendor-comparison model (longer credit = better for the buyer). */
const PAYMENT_TERMS_SCORE = {
  "Net 45": 100,
  "Net 30": 80,
  "Net 15": 60,
  "50% Advance / 50% on Delivery": 40,
  "Cash on Delivery": 20,
  "Advance (100%)": 0
};

const GLOSSARY = [
  { term: "Purchase Requisition (PR)", def: "An internal request raised by a department asking Purchasing to buy something. It can list several line items, each with its own quantity, unit and price." },
  { term: "RFQ (Request for Quotation)", def: "A formal document sent to several vendors asking them to quote a price, delivery time and terms for the same specification, so bids can be compared fairly." },
  { term: "Comparative Statement", def: "A side-by-side comparison of all vendor quotations — by total price, delivery time and terms — used to justify which vendor is selected." },
  { term: "Weighted Vendor Scoring", def: "A scoring model where price, delivery time and payment terms are each given a weight (summing to 100%), producing one ranked score per vendor instead of relying on price alone." },
  { term: "Vendor Negotiation / Counter-Offer", def: "A round where Purchasing proposes a lower price to a vendor before final selection; the vendor can accept it, reject it, or come back with a different price. Limited to one round per vendor." },
  { term: "Senior Management Sign-off", def: "An extra approval required, above and beyond the usual manager approval, for purchase requisitions above a set value — a common governance control for high-value spend." },
  { term: "Purchase Order (PO)", def: "The binding order issued to the winning vendor once selected — the vendor's instruction to supply at the agreed price and terms." },
  { term: "PO Amendment / Change Order", def: "A formal, re-authorised revision to an already-issued Purchase Order — for example a price, quantity, or delivery-date change — recorded with a reason and kept as a numbered history alongside the original PO." },
  { term: "Shipment", def: "One delivery event against a Purchase Order. A single PO can be fulfilled across several shipments if the vendor sends the order in batches." },
  { term: "GRN (Goods Receipt Note)", def: "The warehouse's formal record of what was actually received and accepted into stock after inspection for a given shipment, which may differ from what was delivered if some units are rejected." },
  { term: "3-Way Match", def: "Verifying that the Purchase Order, the Goods Receipt Note(s), and the vendor's Invoice all agree on quantity and price, line by line, before payment is approved — the core control against overpaying or paying for goods never received." },
  { term: "Budget Code", def: "The internal cost-centre code a purchase is charged against, used to track departmental spending against its allocation." },
  { term: "Payment Terms", def: "The agreed timing of payment to the vendor — e.g. Net 30 means payment is due 30 days after the invoice date." },
  { term: "GST", def: "Goods and Services Tax — added on top of the base price of goods/services in India; shown separately from the taxable value on invoices and purchase orders." }
];

/* Each scenario is only the *trigger* — the department stating a need.
   Everything downstream (the PR, the RFQ, quotes, PO, GRN, invoice,
   payment) is created manually by the student; nothing about the actual
   procurement transaction is pre-filled here. */
const SCENARIO_BANK = [
  {
    id: "SCN-01",
    department: "IT Department",
    requestedByRole: "IT Manager",
    itemName: "Laptops for new hires",
    note: "The IT Department has 15 new hires joining next month across engineering and support. None of them currently have work laptops. IT needs standard-issue business laptops (min. i5/Ryzen 5, 16GB RAM, 512GB SSD) procured before onboarding begins.",
    urgency: "High"
  },
  {
    id: "SCN-02",
    department: "Facilities Department",
    requestedByRole: "Facilities Head",
    itemName: "Replacement split air-conditioning units",
    note: "Two of the ground-floor office split ACs failed inspection and cannot be repaired economically. Facilities needs replacement 1.5-ton split AC units with installation, ideally with an energy-efficiency rating of 4 star or above.",
    urgency: "Medium"
  },
  {
    id: "SCN-03",
    department: "Production Department",
    requestedByRole: "Production Supervisor",
    itemName: "Mild steel sheets (raw material)",
    note: "The fabrication line is running low on mild steel sheet stock for the next production batch. Production needs a fresh supply of MS sheets (2mm thickness) to avoid a line stoppage in three weeks.",
    urgency: "Urgent"
  },
  {
    id: "SCN-04",
    department: "Administration Department",
    requestedByRole: "Admin Officer",
    itemName: "Office furniture — workstations and chairs",
    note: "A new team of 8 is being set up in the east wing. Admin needs modular workstation desks and ergonomic chairs for the new seating area, matching the existing office furniture style where possible.",
    urgency: "Medium"
  },
  {
    id: "SCN-05",
    department: "Warehouse Department",
    requestedByRole: "Warehouse Manager",
    itemName: "Industrial pallet racking system",
    note: "The warehouse expansion bay is ready but empty. The Warehouse Department needs heavy-duty pallet racking installed to bring the new bay into use for finished-goods storage.",
    urgency: "Medium"
  },
  {
    id: "SCN-06",
    department: "Electrical Maintenance",
    requestedByRole: "Chief Electrician",
    itemName: "Industrial voltage stabilizers",
    note: "Repeated voltage fluctuation has damaged equipment on the shop floor twice this quarter. Electrical Maintenance needs industrial-grade voltage stabilizers installed on the main production lines.",
    urgency: "High"
  },
  {
    id: "SCN-07",
    department: "Packaging Department",
    requestedByRole: "Packaging Lead",
    itemName: "Corrugated shipping cartons",
    note: "A new export order has been confirmed and current carton stock will run out before the packing run finishes. Packaging needs a fresh bulk order of corrugated shipping cartons in the standard export size.",
    urgency: "Urgent"
  },
  {
    id: "SCN-08",
    department: "Administration Department",
    requestedByRole: "Admin Officer",
    itemName: "Office stationery — quarterly restock",
    note: "Central stationery stock (paper, files, printer consumables, writing supplies) is close to running out across departments. Admin needs the quarterly bulk restock ordered before month-end.",
    urgency: "Low"
  }
];
