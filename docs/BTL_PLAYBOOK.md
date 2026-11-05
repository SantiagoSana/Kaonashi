# Kaonashi BTL Playbook — Below-The-Line Marketing Guide

This playbook guides marketing managers and brand leads through orchestrating, printing, distributing, and measuring physical-to-digital (phygital) activations using the Kaonashi BTL engine.

---

## 1. Creating a Campaign & Setting Objectives

1. Navigate to **Admin → Motor BTL & Campañas** (`/admin/marketing/campaigns`).
2. Define the strategic objective:
   - **Trial**: Drive first-time guests to visit or order (e.g., free duck gyozas on order > $50,000 COP).
   - **Lead Gen**: Build our private omakase guest list via email/WhatsApp capture.
   - **Event / Pop-Up**: Weekend activations with high foot-traffic street teams.
   - **Awareness**: High-impression table tents at partner bars and counters.
3. Establish your financial guardrails:
   - `Target Cost per Order`: Maximum desirable customer acquisition cost.
   - `Floor Cost per Order`: Cut-off point above which a touchpoint receives the **Stop** alert.

---

## 2. Generating & Printing QR Touchpoints

1. Open **Admin → Generador de QR** (`/admin/marketing/qr`).
2. Complete the 5-step wizard:
   - **Step 1 (Campaign)**: Select target campaign.
   - **Step 2 (Touchpoint)**: Choose format (Coaster, Table Tent, Flyer, Takeaway Box, Window Sticker). Set label and physical location.
   - **Step 3 (Destination)**: Choose internal target (`/c/coasters`, `/menu`, or bind to a table like `/menu?table=4`).
   - **Step 4 (Design)**: Ensure contrast ratio is **>= 4.0:1** (checked live). Choose dot modules and Ensō mark.
   - **Step 5 (Export)**: Download high-resolution vector SVG or print-ready PDF with crop marks.
3. **Print Standards**:
   - Coasters: Minimum 2.5 cm width.
   - Table tents & flyers: Minimum 4.0 cm width.

---

## 3. Physical Distribution & Cost Tracking

1. In the **Campaigns** tab, log physical shipments as they leave to partner venues:
   - Touchpoint ID, distribution date, quantity, and promoter.
2. In the **Costs** tab, log variable investments (printing invoices, venue placement fees, street team salaries).
3. The platform computes `Distributed` and calculates true **ROAS** (Attributed Revenue ÷ Total Spend).

---

## 4. Reading the Funnel & Taking Decisions

Open **Admin → Analítica de Embudo** (`/admin/marketing/analytics`):
- **10-Stage Funnel**: Compare drop-off rates across stages:
  1. Distributed → 2. Scans → 3. Unique Scans → 4. Views → 5. Engaged → 6. Leads → 7. Claims → 8. Cart → 9. Checkout → 10. Converted.
- **Touchpoint Leaderboard Actions**:
  - **Scale**: Cost per order is below target cost and ROAS is high. Allocate more print budget.
  - **Fix landing**: High scan rates but lower conversion to orders. Optimize headlines, imagery, or coupon value.
  - **Stop**: Cost per order exceeds the floor threshold after sufficient statistical sample. Revoke or reallocate touchpoint.
