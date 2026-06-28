# Dashboard + Reports + Advanced Settings Fix

## What was added

1. **Dashboard advanced summaries**
   - 20 real business cards from database:
     - Today Sales
     - Today Cash/Jama
     - Today Paid Out
     - Today Profit
     - Month Sales
     - Month Purchases
     - Month Profit
     - Total Purchase Value
     - Customer Receivable
     - Supplier Payable
     - Net Khata Position
     - Inventory Valuation
     - Potential Stock Profit
     - Total Stock KG
     - Active Items
     - Low Stock Items
     - Out of Stock
     - Total Parties
     - Active Committees
     - Committee Pending
   - Top receivable customers
   - Top payable suppliers
   - Low stock alerts

2. **Reports Center**
   - Sidebar `/reports` section is now fully working.
   - 90 report definitions added across:
     - Sales & Billing
     - Purchase & Supplier
     - Inventory & Stock
     - Customer Receivables
     - Supplier Payables
     - Khata & Ledger
     - Payments & Cash Flow
     - Profit & Margin
     - Committee / Besi
   - Every report is connected to real database records and returns summary cards + rows.

3. **Advanced Settings**
   - Sidebar `/settings` section is now fully working.
   - Business profile settings stored in backend JSON file.
   - Manual backup button.
   - Daily automatic backup check on backend startup and every hour.
   - Complete business-data fresh/reset button.
   - Reset requires exact confirmation text: `RESET IQBAL JUTT`.
   - Reset creates a pre-reset database backup before deleting business records.

## Important reset note
The reset button clears business records: inventory, parties/customers/suppliers, sales, purchases, khata transactions, committees and report data derived from those records. It keeps app files and settings safe.

## How to run

Backend:
```bash
cd backend
npm install
npx prisma generate
npm run dev
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Open:
```text
http://localhost:5173
```

## Test checklist

1. Open Dashboard: cards should show real values.
2. Open Reports: report list should show 90 reports.
3. Click any report: rows and summary should load.
4. Open Settings: system counts should load.
5. Click Create Manual Backup: backup should appear in list.
6. Type `RESET IQBAL JUTT` and reset only when you really want fresh business data.
