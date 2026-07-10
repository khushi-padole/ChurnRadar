# ChurnBhau — Product Plan

> **Status**: Awaiting approval — no implementation has begun.

---

## Table of Contents

1. [Assumptions](#1-assumptions)
2. [User Stories](#2-user-stories)
3. [Acceptance Criteria](#3-acceptance-criteria)
4. [Data Shapes](#4-data-shapes)
5. [Affected Files](#5-affected-files)
6. [Edge Cases](#6-edge-cases)
7. [Open Questions](#7-open-questions)

---

## 1. Assumptions

These are stated explicitly so you can override them before implementation begins.

| # | Assumption |
|---|---|
| A1 | Auth is email + password only. No OAuth (Google/GitHub) in v1. |
| A2 | Email verification is required before first login (link-based token, 24 h expiry). |
| A3 | The churn/health score is computed server-side on demand (not pre-stored) and cached in the `Customer` row as `healthScore` + `churnRisk` enum. It is recalculated on every usage log write. |
| A4 | "Usage logs" are ingested manually via UI form or API. No webhook/SDK ingest in v1. |
| A5 | One CSM can be assigned per customer. A Manager oversees all CSMs on their team. An Admin has god-mode access. |
| A6 | MRR is stored as a plain decimal in USD cents (integer) to avoid floating-point issues. Display layer divides by 100. |
| A7 | The seed script will create demo data covering a 6-month window to make charts non-trivial. |
| A8 | Email sending uses **Resend** (free tier, 3 k emails/month). Configurable via env var. |
| A9 | All timestamps are stored in UTC; display is localised in the browser. |
| A10 | Role changes can only be performed by an Admin. A user cannot change their own role. |
| A11 | Soft-delete only for Customers and Interventions (`deletedAt` timestamp). Hard-delete for UsageLogs. |
| A12 | The app will be dark-mode only in v1 (no theme toggle). |
| A13 | CSV import of usage logs is a stretch goal (documented but not built in v1). |
| A14 | Pagination uses cursor-based pagination for customers list; offset pagination for usage logs. |

---

## 2. User Stories

### 2.1 CSM (Customer Success Manager)

| ID | Story |
|---|---|
| CSM-1 | As a CSM, I can log in with my email and password so that I can access my assigned accounts. |
| CSM-2 | As a CSM, I can view a list of my assigned customers, sorted by churn risk, so that I know where to focus. |
| CSM-3 | As a CSM, I can open a customer profile and see their health score, MRR, contract dates, and a 90-day usage trend chart. |
| CSM-4 | As a CSM, I can log a new usage data point for a customer (login count, active users, feature flags, API calls) so that the health score updates automatically. |
| CSM-5 | As a CSM, I can create an intervention (type: Email / Call / Meeting / Discount / Training) against a customer with notes and a scheduled date. |
| CSM-6 | As a CSM, I can update an intervention's status (Planned → In Progress → Completed / Cancelled) and record the outcome. |
| CSM-7 | As a CSM, I can search my customer list by company name and filter by risk tier (Low / Medium / High / Critical). |
| CSM-8 | As a CSM, I receive an in-app notification when a customer I own drops a risk tier (e.g., Medium → High). |
| CSM-9 | As a CSM, I can view my personal dashboard: my portfolio's average health score, count of at-risk accounts, and upcoming scheduled interventions. |
| CSM-10 | As a CSM, I can update my profile (name, avatar) and change my password. |

### 2.2 Manager

| ID | Story |
|---|---|
| MGR-1 | As a Manager, I can see all customers across all CSMs, not just my own. |
| MGR-2 | As a Manager, I can filter the customer list by assigned CSM. |
| MGR-3 | As a Manager, I can reassign a customer from one CSM to another. |
| MGR-4 | As a Manager, I can view a CSM leaderboard showing each CSM's portfolio: avg health score, at-risk count, and interventions completed this month. |
| MGR-5 | As a Manager, I can view the Analytics page: cohort churn trends, MRR at risk breakdown, intervention effectiveness, and risk distribution. |
| MGR-6 | As a Manager, I can export the customer list to CSV. |
| MGR-7 | As a Manager, I can create and edit customers (not limited to assigned accounts). |
| MGR-8 | As a Manager, I can view (but not create) Usage Logs for any customer. |

### 2.3 Admin

| ID | Story |
|---|---|
| ADM-1 | As an Admin, I have all Manager capabilities plus user management. |
| ADM-2 | As an Admin, I can invite new users by email (they receive a setup link). |
| ADM-3 | As an Admin, I can change any user's role (CSM ↔ Manager ↔ Admin). |
| ADM-4 | As an Admin, I can deactivate (soft-ban) a user account. A deactivated user cannot log in. |
| ADM-5 | As an Admin, I can view a system audit log: who created/edited/deleted records and when. |
| ADM-6 | As an Admin, I can hard-delete a customer and all associated data (usage logs, interventions). |
| ADM-7 | As an Admin, I can view site-wide system stats: total users, total customers, total MRR tracked. |
| ADM-8 | As an Admin, I can configure the churn score weights (login weight, feature usage weight, etc.) via a settings panel, and all scores recalculate. |

---

## 3. Acceptance Criteria

### AC: CSM-1 — Login

- [ ] Submitting valid credentials redirects to `/dashboard`.
- [ ] Invalid credentials show field-level error "Invalid email or password".
- [ ] Unverified email shows "Please verify your email. Resend?" with a resend button.
- [ ] Deactivated account shows "Your account has been deactivated. Contact your admin."
- [ ] Password field has show/hide toggle.
- [ ] Form is protected against brute force: after 5 failed attempts in 15 min, show lockout message.

### AC: CSM-2 — Customer List (CSM view)

- [ ] Only customers where `assignedCsmId === session.userId` are shown.
- [ ] Default sort: `churnRisk` descending (CRITICAL first), then `healthScore` ascending.
- [ ] Search debounces 300 ms; filters by `companyName` (case-insensitive, partial match).
- [ ] Risk filter chip (All / Low / Medium / High / Critical) updates URL query param.
- [ ] Table shows: Company, Tier, MRR, Health Score (badge), Risk (coloured badge), CSM, Last Activity, Actions.
- [ ] Pagination: 20 rows per page with cursor-based "Load More" or page controls.

### AC: CSM-3 — Customer Profile

- [ ] Health score displayed as a gauge (0–100) with colour zones: red < 40, amber 40–70, green > 70.
- [ ] Usage trend chart: line chart of `loginCount` and `activeUsers` over last 90 days (or full history if shorter).
- [ ] Contract dates show countdown: "Renews in 42 days" or "Expired 7 days ago" (red).
- [ ] Intervention history shows most recent 10; "View all" expands or navigates.
- [ ] "Edit Customer" button visible to CSM (own accounts), Manager (any), Admin (any).

### AC: CSM-4 — Log Usage

- [ ] Form fields: Date (date picker, defaults to today), Login Count (integer ≥ 0), Active Users (integer ≥ 0), API Calls (integer ≥ 0), Session Duration (minutes, decimal ≥ 0), Feature Flags (multi-select from predefined list).
- [ ] Only one log allowed per customer per calendar date. Duplicate date returns 409 + "A log for this date already exists."
- [ ] On successful save, health score and churn risk recalculate and the customer row updates optimistically.
- [ ] Validation errors are inline, not toast-only.

### AC: CSM-5/6 — Interventions

- [ ] Intervention form: Customer (auto-filled if on customer page), Type, Status (defaults to Planned), Notes (textarea, max 2000 chars), Scheduled Date.
- [ ] Completed interventions require an Outcome field (textarea, max 1000 chars).
- [ ] CSM can only edit/delete interventions they created. Managers and Admins can edit any.
- [ ] Kanban board columns: Planned | In Progress | Completed | Cancelled. Drag-and-drop to change status (stretch; fallback: dropdown).

### AC: MGR-4 — CSM Leaderboard

- [ ] Shows each CSM: name, avatar, portfolio size, avg health score, # at-risk, # interventions this month.
- [ ] Sorted by avg health score descending by default.
- [ ] Clicking a CSM row filters the customer list to that CSM.

### AC: ADM-2 — Invite User

- [ ] Admin enters email + selects role; system sends invite email with a one-time setup link (48 h expiry).
- [ ] If email already exists in DB, return 409 "User already exists."
- [ ] Invited-but-not-accepted users appear in admin user list with status "Pending".

### AC: ADM-5 — Audit Log

- [ ] Captures: entity type, entity id, action (CREATE / UPDATE / DELETE), changed fields (JSON diff), actor userId, timestamp.
- [ ] Paginated table, searchable by actor or entity.
- [ ] Non-admins cannot access `/admin/audit`.

### AC: ADM-8 — Score Weights Config

- [ ] Five sliders (0–100), must sum to 100. Save button disabled until sum = 100.
- [ ] On save, a background job (or immediate server action) recalculates `healthScore` and `churnRisk` for every customer.
- [ ] Change is recorded in the audit log.

---

## 4. Data Shapes

### 4.1 `Customer`

```ts
interface Customer {
  id: string;                    // cuid2
  companyName: string;           // max 200 chars
  industry: Industry;            // enum: SAAS | ECOMMERCE | FINTECH | HEALTHCARE | RETAIL | OTHER
  tier: Tier;                    // enum: FREE | STARTER | PRO | ENTERPRISE
  mrrCents: number;              // integer, USD cents (e.g., 49900 = $499/month)
  contractStart: Date;
  contractEnd: Date | null;      // null = month-to-month
  website: string | null;
  logoUrl: string | null;
  notes: string | null;          // max 5000 chars
  healthScore: number;           // 0–100, float, recomputed on usage log write
  churnRisk: ChurnRisk;          // enum: LOW | MEDIUM | HIGH | CRITICAL
  status: CustomerStatus;        // enum: ACTIVE | CHURNED | PAUSED
  assignedCsmId: string | null;  // FK → User
  createdById: string;           // FK → User
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;        // soft delete
}
```

### 4.2 `UsageLog`

```ts
interface UsageLog {
  id: string;                    // cuid2
  customerId: string;            // FK → Customer
  logDate: Date;                 // date only (stored as midnight UTC); unique per customer
  loginCount: number;            // integer ≥ 0
  activeUsers: number;           // integer ≥ 0
  apiCalls: number;              // integer ≥ 0
  sessionDurationMinutes: number; // float ≥ 0
  featuresUsed: string[];        // array of feature flag strings, stored as JSON
  createdById: string;           // FK → User (who logged it)
  createdAt: Date;
}

// Predefined feature flags (stored in app config, not DB)
type FeatureFlag =
  | "REPORTING"
  | "API_ACCESS"
  | "INTEGRATIONS"
  | "AUTOMATIONS"
  | "TEAM_COLLABORATION"
  | "CUSTOM_ROLES"
  | "WEBHOOKS"
  | "SSO"
  | "WHITE_LABEL"
  | "ADVANCED_ANALYTICS";
```

### 4.3 `HealthScore` (computed, not a separate table)

```ts
interface HealthScoreBreakdown {
  total: number;                 // 0–100, weighted sum
  components: {
    loginFrequency: {
      score: number;             // 0–100 sub-score
      weight: number;            // e.g., 0.25 (25%)
      weighted: number;          // score * weight
      rawValue: string;          // human label: "4.2 logins/day (last 30d)"
    };
    featureBreadth: {
      score: number;
      weight: number;
      weighted: number;
      rawValue: string;          // "6 / 10 features used"
    };
    activeUserGrowth: {
      score: number;
      weight: number;
      weighted: number;
      rawValue: string;          // "+12% MoM"
    };
    apiEngagement: {
      score: number;
      weight: number;
      weighted: number;
      rawValue: string;          // "1,240 calls/day"
    };
    contractProximity: {
      score: number;
      weight: number;
      weighted: number;
      rawValue: string;          // "Renews in 34 days"
    };
  };
  riskTier: ChurnRisk;          // derived: CRITICAL <40 | HIGH 40-59 | MEDIUM 60-74 | LOW ≥75
  computedAt: Date;
}
```

**Scoring algorithm (default weights):**

| Component | Weight | 100-point formula |
|---|---|---|
| Login Frequency | 25% | `min(1, avgLoginsLast30d / targetLogins) * 100` where `targetLogins = 5/day` |
| Feature Breadth | 20% | `(uniqueFeaturesLast30d / 10) * 100` |
| Active User Growth | 20% | `clamp((MoMGrowth + 0.5) * 100, 0, 100)` |
| API Engagement | 15% | `min(1, avgApiCallsLast30d / 500) * 100` |
| Contract Proximity | 20% | `100` if > 90 days to renewal, `50` if 30–90 days, `0` if < 30 days or expired |

Score < 40 → CRITICAL, 40–59 → HIGH, 60–74 → MEDIUM, ≥ 75 → LOW.

If a customer has **no usage logs**, health score defaults to 50 and risk is HIGH.

### 4.4 `Intervention`

```ts
interface Intervention {
  id: string;                     // cuid2
  customerId: string;             // FK → Customer
  createdById: string;            // FK → User
  type: InterventionType;         // enum: EMAIL | CALL | MEETING | DISCOUNT | TRAINING | OTHER
  status: InterventionStatus;     // enum: PLANNED | IN_PROGRESS | COMPLETED | CANCELLED
  title: string;                  // max 200 chars
  notes: string | null;           // max 2000 chars
  scheduledAt: Date | null;
  completedAt: Date | null;       // set when status → COMPLETED
  outcome: string | null;         // required when status = COMPLETED; max 1000 chars
  healthScoreBefore: number | null; // snapshot at creation
  healthScoreAfter: number | null;  // snapshot at completion
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;         // soft delete
}
```

### 4.5 `User`

```ts
interface User {
  id: string;                    // cuid2
  email: string;                 // unique, lowercase
  name: string;                  // max 100 chars
  passwordHash: string;          // bcrypt, rounds=12
  role: Role;                    // enum: ADMIN | MANAGER | CSM
  emailVerified: Date | null;
  avatarUrl: string | null;
  isActive: boolean;             // false = soft-banned
  invitedById: string | null;    // FK → User (who invited them)
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.6 `Notification`

```ts
interface Notification {
  id: string;
  userId: string;                // FK → User (recipient)
  type: NotificationType;        // enum: RISK_ESCALATION | INTERVENTION_DUE | SYSTEM
  title: string;
  message: string;
  customerId: string | null;     // related customer if applicable
  read: boolean;                 // default false
  createdAt: Date;
}
```

### 4.7 `AuditLog`

```ts
interface AuditLog {
  id: string;
  actorId: string;               // FK → User
  entityType: string;            // "Customer" | "User" | "Intervention" | etc.
  entityId: string;
  action: AuditAction;           // enum: CREATE | UPDATE | DELETE
  diff: Record<string, { before: unknown; after: unknown }>; // JSON
  ipAddress: string | null;
  createdAt: Date;
}
```

### 4.8 `ScoreWeightConfig`

```ts
interface ScoreWeightConfig {
  id: string;                    // single row (id = "global")
  loginFrequencyWeight: number;  // 0–1, must sum to 1 with others
  featureBreadthWeight: number;
  activeUserGrowthWeight: number;
  apiEngagementWeight: number;
  contractProximityWeight: number;
  updatedById: string;           // FK → User (last Admin who changed)
  updatedAt: Date;
}
```

---

## 5. Affected Files

Identical structure mapped to root directory: `d:/Sem5/ChurnBhau`.

---

## 6. Edge Cases

Refer to original product plan.

---

## 7. Open Questions (Resolved)

1. **OQ1 — Email provider**: Resend API key: `re_WLezRAf7_3FqncFroT7kytkj3nGUJcYKL`
2. **OQ2 — Supabase project**: Direct URL: `postgresql://postgres:[KhushiYP@0908]@db.dqklcdcwmdkejkoginin.supabase.co:5432/postgres` (Note: Brackets around password will be removed/escaped).
3. **OQ3 — NextAuth secret**: `AUTH_SECRET=4EiGEPO9wnGkIjrXnIYoFzKpjt/cols8JhLVtLT+NuA=`
4. **OQ4 — Drag-and-drop on Kanban**: Simple dropdown per card (no @dnd-kit).
5. **OQ5 — Avatar upload**: URL input only.
6. **OQ6 — Password reset**: Full email flow with Resend.
7. **OQ7 — Mobile responsiveness**: Fully responsive with Tailwind.
8. **OQ8 — Real-time notifications**: Polling every 30s.
9. **OQ9 — Churn score recalculation timing**: Synchronously in same API call.
10. **OQ10 — Seed data demo users**: admin@churnradar.com / Demo1234!
