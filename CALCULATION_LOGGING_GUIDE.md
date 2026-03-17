# Calculation Logging Guide

This document describes all the logging added to track financial calculations for debugging purposes.

## Logging Locations

### 1. Dashboard Route (`/api/dashboard`)

**File:** `src/app/api/dashboard/route.ts`

When this endpoint is called, it logs:

#### Yearly Calculations
```
=== DASHBOARD YEARLY CALCULATIONS ===
Nepali Year: [year]
Year Start: [date]

--- Purchase Stats ---
Total Purchases: [amount]
Purchase Count: [count]

--- Sale Stats ---
Total Sales: [amount]
Sale Count: [count]

--- Yearly Cash Breakdown ---
Txn Sale Paid (from sale txns this year): [amount]
Txn Purchase Paid (from purchase txns this year): [amount]
Standalone Pay In: [amount]
Standalone Pay Out: [amount]
Linked Payment Pay In (old txns): [amount]
Linked Payment Pay Out (old txns): [amount]

--- Money In Calculation ---
  = txnSalePaid(...) + standalonePayIn(...) + linkedOldPayIn(...)
  = [total]

--- Money Out Calculation ---
  = txnPurchasePaid(...) + standalonePayOut(...) + linkedOldPayOut(...)
  = [total]
```

#### Outstanding Balance Per-Party
```
--- Outstanding Balance Calculation (Per-Party) ---
Total Parties: [count]

Party: [partyId]
  Opening Balance: [amount]
  Total Sales Due: [amount]
  Total Purchases Due: [amount]
  Total Pay In: [amount]
  Total Pay Out: [amount]
  Receivable: [amount]
  Payable: [amount]

[... repeated for each party ...]

--- Outstanding Balance Totals ---
Total Receivable (sum of all parties): [amount]
Total Payable (sum of all parties): [amount]
Total Customer Advance: [amount]
Total Supplier Advance: [amount]
```

### 2. Financial Utilities (`src/lib/financial.ts`)

**Function:** `calculatePartyOutstanding()`

When a party's outstanding balance is calculated (in development mode), it logs:

```
[calculatePartyOutstanding]
  Input opening: [amount]
  Input totalSalesDue: [amount]
  Input totalPurchasesDue: [amount]
  Input totalPayIn: [amount]
  Input totalPayout: [amount]
  → openingCredit: [amount] openingDebit: [amount]
  → saleSide: [amount]
  → purchaseSide: [amount]
  → customerAdvance: [amount]
  → supplierAdvance: [amount]
  → receivable: [amount] payable: [amount] net: [amount]
```

### 3. Transaction Pre-Save Middleware (`src/models/transaction.model.ts`)

When a transaction is created or updated (in development mode), it logs:

```
[Transaction Pre-Save]
  Type: [purchase/sale]
  Party: [partyId]
  Product: [productId]
  Calculation:
    qty([qty]) × rate([rate]) = total([total])
    total([total]) - paid([paid]) = balance([balance])
    isNew: [true/false]
  Stock Update (PURCHASE/SALE):
    Before: [stock]
    Adding/Deducting: [qty]
    After: [new_stock]
```

### 4. Payment Processing (`src/app/api/payments/route.ts`)

When a linked payment is created, it logs:

```
[Payment Processing]
  Party ID: [partyId]
  Linked to Txn: [txnId last 6 chars]
  Txn Type: [purchase/sale]
  Txn Total: [amount]
  Already Paid: [amount]
  Remaining: [amount]
  Payment Amount: [amount]

  OVERPAYMENT DETECTED!
    Amount Paid: [amount]
    Required Amount: [amount]
    Excess Amount: [amount]
    Action: Splitting into linked + advance
```

## What to Check

### For Dashboard Accuracy

1. **Yearly Calculations** should match:
   - Purchases: Sum of all purchase transactions created this year
   - Sales: Sum of all sale transactions created this year
   - Money In should equal: payments received from sales + standalone payin + linked payments to old transactions
   - Money Out should equal: payments made for purchases + standalone payout + linked payments to old transactions

2. **Outstanding Balance** should match:
   - Sum of all per-party receivables
   - Sum of all per-party payables
   - Each party calculation should be correct per the formula

### For Transaction Calculations

1. **totalAmount** should always be: `quantity × ratePerKg`
2. **balanceAmount** should always be: `totalAmount - paidAmount`
3. **Stock** should be updated correctly:
   - Purchase: stock increases by quantity
   - Sale: stock decreases by quantity (cannot be more than available)

### For Payment Processing

1. **Normal Payment:** Payment reduces `transaction.paidAmount`
2. **Overpayment Split:**
   - Linked payment created for remaining amount
   - Standalone (advance) payment created for excess
   - Transaction marked as fully paid

## How to Use This Log

1. Set `NODE_ENV=development` to enable all logging
2. Make an API call to a calculation endpoint
3. Check the Node.js console output
4. Verify the calculations match your expectations
5. Report any discrepancies with the complete log output

## Example: Verify Dashboard Money In

```
Expected: Rs. 500,000
From Log:
  Txn Sale Paid: 300,000
  Standalone Pay In: 150,000
  Linked Payment Pay In (old txns): 50,000
  Total: 300,000 + 150,000 + 50,000 = 500,000 ✓
```

## Disabling Logging

To disable logging permanently, remove the `if (process.env.NODE_ENV === "development")` checks or set `NODE_ENV=production`.
