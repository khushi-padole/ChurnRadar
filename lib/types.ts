// Enums
export type Role = 'CSM' | 'MANAGER' | 'ADMIN';

export type Industry = 'SAAS' | 'ECOMMERCE' | 'FINTECH' | 'HEALTHCARE' | 'RETAIL' | 'OTHER';

export type Tier = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export type ChurnRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CustomerStatus = 'ACTIVE' | 'CHURNED' | 'PAUSED';

export type InterventionType = 'EMAIL' | 'CALL' | 'MEETING' | 'DISCOUNT' | 'TRAINING' | 'OTHER';

export type InterventionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type NotificationType = 'RISK_ESCALATION' | 'INTERVENTION_DUE' | 'SYSTEM';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type TokenType = 'VERIFICATION' | 'PASSWORD_RESET' | 'USER_INVITE';

// Predefined feature flags (not stored in DB enum, stored in JSON array)
export type FeatureFlag =
  | 'REPORTING'
  | 'API_ACCESS'
  | 'INTEGRATIONS'
  | 'AUTOMATIONS'
  | 'TEAM_COLLABORATION'
  | 'CUSTOM_ROLES'
  | 'WEBHOOKS'
  | 'SSO'
  | 'WHITE_LABEL'
  | 'ADVANCED_ANALYTICS';

// Database Models
export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  emailVerified: Date | null; // Nullable
  avatarUrl: string | null;   // Nullable
  isActive: boolean;
  invitedById: string | null; // Nullable
  lastLoginAt: Date | null;   // Nullable
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  companyName: string;
  industry: Industry;
  tier: Tier;
  mrrCents: number;
  contractStart: Date;
  contractEnd: Date | null;   // Nullable
  website: string | null;     // Nullable
  logoUrl: string | null;     // Nullable
  notes: string | null;       // Nullable
  healthScore: number;
  churnRisk: ChurnRisk;
  status: CustomerStatus;
  assignedCsmId: string | null; // Nullable
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;     // Nullable (soft delete)
}

export interface UsageLog {
  id: string;
  customerId: string;
  logDate: Date;
  loginCount: number;
  activeUsers: number;
  apiCalls: number;
  sessionDurationMinutes: number;
  featuresUsed: FeatureFlag[] | string[]; // Stored as JSON array
  createdById: string;
  createdAt: Date;
}

export interface Intervention {
  id: string;
  customerId: string;
  createdById: string;
  type: InterventionType;
  status: InterventionStatus;
  title: string;
  notes: string | null;       // Nullable
  scheduledAt: Date | null;   // Nullable
  completedAt: Date | null;   // Nullable
  outcome: string | null;     // Nullable
  healthScoreBefore: number | null; // Nullable
  healthScoreAfter: number | null;  // Nullable
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;     // Nullable (soft delete)
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  customerId: string | null; // Nullable
  read: boolean;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  diff: Record<string, { before: unknown; after: unknown }>; // Stored as JSON
  ipAddress: string | null; // Nullable
  createdAt: Date;
}

export interface ScoreWeightConfig {
  id: string; // Defaults to "global"
  loginFrequencyWeight: number;
  featureBreadthWeight: number;
  activeUserGrowthWeight: number;
  apiEngagementWeight: number;
  contractProximityWeight: number;
  updatedById: string;
  updatedAt: Date;
}

export interface Token {
  id: string;
  email: string;
  token: string;
  expiresAt: Date;
  type: TokenType;
  createdAt: Date;
}
