# Supari Khata - Accounting System Design (Production Ready)

## 1. DATA MODEL DESIGN

### Core Principle
A **transaction-based accounting system** where:
- Transactions represent business events (buy/sell)
- Payments represent cash movements
- Outstanding balance = transaction value - cash received/paid

### 1.1 Party (Supplier/Customer)

```typescript
interface IParty {
  name: string;                          // "Raj Kumar" | "ABC Supply Co."
  category: "supplier" | "customer" | "both";
  phone?: string;
  address?: string;
  openingBalance: number;                // Positive = they owe you, Negative = you owe them
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Key Principle:**
- `openingBalance > 0` = Party OWES YOU (receivable)
- `openingBalance < 0` = YOU OWE PARTY (payable)

---

### 1.2 Product

```typescript
interface IProduct {
  name: string;                          // "Raw Cashew" | "Processed Nuts"
  unit: "kg" | "quintal";
  description?: string;
  currentStock: Decimal128;              // Real-time quantity
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 1.3 Transaction (The Core)

```typescript
interface ITransaction {
  type: "purchase" | "sale";
  partyId: ObjectId;                     // Who did we trade with?
  productId: ObjectId;                   // What product?

  // Quantity & Rate
  quantity: Decimal128;                  // kg
  ratePerKg: Decimal128;                 // Price per unit (locked at transaction time)

  // Financial State
  totalAmount: Decimal128;               // quantity × ratePerKg (auto-calculated)
  paidAmount: Decimal128;                // Cash paid at time of transaction (0 = full credit)
  balanceAmount: Decimal128;             // totalAmount - paidAmount (what remains due)

  // Metadata
  date: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Pre-save Logic:**
1. Auto-calculate: `totalAmount = quantity × ratePerKg`
2. Auto-calculate: `balanceAmount = totalAmount - paidAmount`
3. Update product stock (only on NEW transactions, not on updates)
   - Purchase: `stock += quantity`
   - Sale: `stock -= quantity` (check oversell)

---

### 1.4 Payment (Standalone Cash Movement)

```typescript
interface IPayment {
  partyId: ObjectId;
  transactionId?: ObjectId;              // Optional: settle specific transaction

  amount: Decimal128;                    // Cash amount
  direction: "payin" | "payout";         // Who pays whom?
  method: "cash" | "bank_transfer" | "cheque" | "upi" | "other";

  date: Date;
  referenceNumber?: string;              // Cheque no / UTR / UPI ref
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Semantics:**
- `direction: "payin"` = Party PAYS YOU back
- `direction: "payout"` = YOU PAY the party

**Two Types of Payments:**
1. **Linked Payment** (`transactionId` is set)
   - Settles part/all of a specific transaction
   - Updates that transaction's `paidAmount` + `balanceAmount`

2. **Standalone Payment** (`transactionId` is null)
   - General cash movement (refund, advance, etc.)
   - Not tied to any transaction

---

### 1.5 Ledger (Optional - For Advanced Auditing)

For full double-entry accounting, add:

```typescript
interface ILedger {
  partyId: ObjectId;
  transactionId?: ObjectId;
  paymentId?: ObjectId;

  account: "receivable" | "payable" | "sales" | "purchases" | "cash";
  debit: number;    // Money coming in / assets increasing
  credit: number;   // Money going out / liabilities increasing

  description: string;
  date: Date;
}
```

For now, this is **optional** — most businesses only need transaction + payment.

---

## 2. CORRECT DASHBOARD FORMULAS

### 2.1 Yearly Activity

**Total Purchases (Year-to-Date)**
```
= SUM(transaction.totalAmount WHERE type="purchase" AND date >= yearStart)
```
This is the **business value** of all purchases, regardless of payment status.

**Total Sales (Year-to-Date)**
```
= SUM(transaction.totalAmount WHERE type="sale" AND date >= yearStart)
```
This is the **business value** of all sales, regardless of payment status.

---

### 2.2 Cash Flow (Actual Cash Movements)

**Money In** (What you actually received)
```
= SUM(transaction.paidAmount WHERE type="sale")
+ SUM(payment.amount WHERE direction="payin" AND transactionId IS NULL)
```
- Sale transactions: only the `paidAmount` (not full sale value)
- Plus standalone payments from customers

**Money Out** (What you actually paid)
```
= SUM(transaction.paidAmount WHERE type="purchase")
+ SUM(payment.amount WHERE direction="payout" AND transactionId IS NULL)
```
- Purchase transactions: only the `paidAmount` (not full purchase value)
- Plus standalone payments to suppliers

**Net Cashflow**
```
= Money In - Money Out
```

---

### 2.3 Outstanding Balances (What's Still Due)

**Outstanding Receivable** (Money customers owe you)
```
Outstanding Receivable per party =
  openingBalance[if positive]
  + SUM(sale transaction.balanceAmount)
  - SUM(standalone payment IN for this party)
```

**Outstanding Payable** (Money you owe suppliers)
```
Outstanding Payable per party =
  ABS(openingBalance[if negative])
  + SUM(purchase transaction.balanceAmount)
  - SUM(standalone payment OUT for this party)
```

**Aggregated (All Parties)**
```
Total Outstanding Receivable = SUM(receivable per party > 0)
Total Outstanding Payable = SUM(payable per party > 0)
```

---

### 2.4 The KEY Insight

**Do NOT mix:**
- `transaction.totalAmount` with `transaction.paidAmount`
- Linked payments with standalone payments

**Purpose:**
- `totalAmount` = Business value (P&L)
- `paidAmount` = Cash movement (Cashflow)
- `balanceAmount` = Future cash due (Outstanding)

Example:
```
Sale to Rajesh for 10,000:
- totalAmount = 10,000    (counts toward sales)
- paidAmount = 3,000      (actual cash received)
- balanceAmount = 7,000   (what he still owes)

Later Rajesh pays 5,000:
- Payment created: amount=5,000, direction="payin", transactionId=<this sale>
- This reduces transaction.balanceAmount to 2,000
- Or if standalone: it's a separate payment entry

Cashflow Summary:
- Sales total = 10,000
- Money In = 3,000 (initial) + 5,000 (payment) = 8,000
- Outstanding Receivable = 2,000
- Net = Sales (10,000) - Money In (8,000) = 2,000 ✓
```

---

## 3. MONGODB AGGREGATION QUERIES

### 3.1 Yearly Activity

```javascript
// Total Purchases & Sales for Current Year
db.transactions.aggregate([
  {
    $match: {
      partyId: { $in: activePartyIds },
      date: { $gte: yearStartDate },
      type: { $in: ["purchase", "sale"] }
    }
  },
  {
    $group: {
      _id: "$type",
      totalAmount: { $sum: { $toDouble: "$totalAmount" } },
      count: { $sum: 1 }
    }
  }
])

// Result:
// { _id: "purchase", totalAmount: 500000, count: 45 }
// { _id: "sale", totalAmount: 750000, count: 60 }
```

### 3.2 Outstanding Per Party

```javascript
// Get all parties with their outstanding balances
db.parties.aggregate([
  {
    $match: { isActive: true }
  },
  {
    $lookup: {
      from: "transactions",
      localField: "_id",
      foreignField: "partyId",
      as: "transactions"
    }
  },
  {
    $lookup: {
      from: "payments",
      localField: "_id",
      foreignField: "partyId",
      let: { partyId: "$_id" },
      pipeline: [
        {
          $match: {
            $or: [
              { transactionId: { $exists: false } },
              { transactionId: null }
            ]
          }
        }
      ],
      as: "standalonePayments"
    }
  },
  {
    $addFields: {
      saleBalance: {
        $sum: {
          $map: {
            input: { $filter: { input: "$transactions", cond: { $eq: ["$$this.type", "sale"] } } },
            in: { $toDouble: "$$this.balanceAmount" }
          }
        }
      },
      purchaseBalance: {
        $sum: {
          $map: {
            input: { $filter: { input: "$transactions", cond: { $eq: ["$$this.type", "purchase"] } } },
            in: { $toDouble: "$$this.balanceAmount" }
          }
        }
      },
      payIn: {
        $sum: {
          $map: {
            input: { $filter: { input: "$standalonePayments", cond: { $eq: ["$$this.direction", "payin"] } } },
            in: { $toDouble: "$$this.amount" }
          }
        }
      },
      payOut: {
        $sum: {
          $map: {
            input: { $filter: { input: "$standalonePayments", cond: { $eq: ["$$this.direction", "payout"] } } },
            in: { $toDouble: "$$this.amount" }
          }
        }
      }
    }
  },
  {
    $project: {
      _id: 1,
      name: 1,
      openingBalance: { $toDouble: "$openingBalance" },
      saleBalance: 1,
      purchaseBalance: 1,
      payIn: 1,
      payOut: 1,
      receivable: {
        $max: [
          {
            $subtract: [
              { $add: [{ $toDouble: "$openingBalance" }, "$saleBalance"] },
              "$payIn"
            ]
          },
          0
        ]
      },
      payable: {
        $max: [
          {
            $subtract: [
              { $add: [{ $abs: { $toDouble: "$openingBalance" } }, "$purchaseBalance"] },
              "$payOut"
            ]
          },
          0
        ]
      }
    }
  }
])
```

### 3.3 Daily Cashflow (Last 7 Days)

```javascript
db.aggregate([
  {
    $facet: {
      transactions: [
        {
          $match: {
            date: { $gte: sevenDaysAgo }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
              type: "$type"
            },
            totalPaid: { $sum: { $toDouble: "$paidAmount" } }
          }
        }
      ],
      payments: [
        {
          $match: {
            date: { $gte: sevenDaysAgo },
            transactionId: { $exists: false }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
              direction: "$direction"
            },
            totalAmount: { $sum: { $toDouble: "$amount" } }
          }
        }
      ]
    }
  }
])

// Combine in application layer:
// For each day:
//   moneyIn = txn(sale).totalPaid + payment(payin).totalAmount
//   moneyOut = txn(purchase).totalPaid + payment(payout).totalAmount
```

### 3.4 Monthly Cashflow (Last 6 Months)

```javascript
// Similar to daily, but group by month
// For Nepali calendar, adjust date arithmetic accordingly
db.transactions.aggregate([
  {
    $match: {
      date: { $gte: sixMonthsAgo }
    }
  },
  {
    $group: {
      _id: {
        year: { $year: "$date" },
        month: { $month: "$date" },
        type: "$type"
      },
      totalPaid: { $sum: { $toDouble: "$paidAmount" } }
    }
  },
  {
    $sort: { "_id.year": 1, "_id.month": 1 }
  }
])
```

---

## 4. KEY VALIDATION RULES

### Transaction Validation
- ✅ quantity > 0
- ✅ ratePerKg > 0
- ✅ 0 ≤ paidAmount ≤ totalAmount
- ✅ On sale: verify stock availability
- ✅ balanceAmount = totalAmount - paidAmount (auto-calculated, not user input)

### Payment Validation
- ✅ amount > 0
- ✅ If linked (transactionId set): amount ≤ transaction.balanceAmount
- ✅ direction must be "payin" or "payout"

### Party Opening Balance
- ✅ Can be positive (they owe you) or negative (you owe them)
- ✅ Interpretation depends on party category:
  - "customer": positive = they owe you ✓
  - "supplier": negative = you owe them ✓
  - "both": can be either

---

## 5. IMPLEMENTATION CHECKLIST

- [ ] Update Transaction model pre-save to calculate totalAmount & balanceAmount
- [ ] Update Payment model with optional transactionId linking
- [ ] Create /api/dashboard aggregation for yearly stats
- [ ] Create /api/dashboard/cashflow for daily/monthly cashflow
- [ ] Create /api/parties/:id/balance for individual party balances
- [ ] Implement cashflow calculation logic (combine txn + payments)
- [ ] Fix outstanding balance calculation to prevent party cross-netting
- [ ] Validate no double-counting of linked payments
- [ ] Add tests for financial calculations
- [ ] Document formulas with inline comments in code

---

## 6. REFERENCES

- Khatabook: Separates transactions from payments
- Tally: Double-entry with ledger accounts
- Supari Khata: Hybrid approach (transaction + payment combo)

