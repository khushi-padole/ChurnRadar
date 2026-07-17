/**
 * Account Module – Vitest Test Suite
 *
 * Coverage:
 *  - registerUser : happy path, 3 boundary values, 1 failure mode (duplicate email)
 *  - verifyEmail  : happy path, 2 failure modes (missing token, expired token)
 *  - loginUser    : happy path, 3 failure modes (wrong password, deactivated, unverified)
 *
 * Mocked dependencies:
 *  - ../db          (prisma client)
 *  - ../email       (sendVerificationEmail)
 *  - bcryptjs       (hash + compare) – avoids slow real hashing in tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerUser, verifyEmail, loginUser } from "../account";
import { prisma } from "../db";
import { sendVerificationEmail } from "../email";

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock("../db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    token: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
  pool: {},
}));

vi.mock("../email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock bcryptjs so we don't run slow real hashing in unit tests.
// hash()   → returns a deterministic fake hash string.
// compare() → returns true only when password === "Password123!" (our valid password).
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$FAKE_HASH"),
    compare: vi.fn(
      (plain: string, _hash: string) => Promise.resolve(plain === "Password123!")
    ),
  },
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseUser = {
  id: "user-uuid-001",
  email: "test@example.com",
  name: "John Doe",
  passwordHash: "$FAKE_HASH",
  role: "CSM" as const,
  emailVerified: new Date("2025-01-01T00:00:00Z"),
  avatarUrl: null,
  isActive: true,
  invitedById: null,
  lastLoginAt: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

const validRegistrationInput = {
  email: "test@example.com",
  name: "John Doe",
  password: "Password123!",
};

const validLoginInput = {
  email: "test@example.com",
  password: "Password123!",
};

// ---------------------------------------------------------------------------
// registerUser
// ---------------------------------------------------------------------------

describe("registerUser", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Happy path ─────────────────────────────────────────────────────────

  it("HAPPY PATH: creates a new user, a verification token, and sends a verification email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ ...baseUser, emailVerified: null });
    vi.mocked(prisma.token.create).mockResolvedValue({
      id: "tok-001",
      email: baseUser.email,
      token: "uuid-token",
      expiresAt: new Date(Date.now() + 86_400_000),
      type: "VERIFICATION",
      createdAt: new Date(),
    });

    const user = await registerUser(validRegistrationInput);

    expect(user.email).toBe("test@example.com");
    expect(prisma.user.create).toHaveBeenCalledOnce();
    expect(prisma.token.create).toHaveBeenCalledOnce();
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      "test@example.com",
      expect.any(String)
    );
  });

  it("HAPPY PATH: normalises the email to lowercase before storing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ ...baseUser, emailVerified: null });
    vi.mocked(prisma.token.create).mockResolvedValue({
      id: "tok-002",
      email: "upper@example.com",
      token: "uuid-token-2",
      expiresAt: new Date(Date.now() + 86_400_000),
      type: "VERIFICATION",
      createdAt: new Date(),
    });

    await registerUser({ ...validRegistrationInput, email: "UPPER@Example.COM" });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "upper@example.com" },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "upper@example.com" }),
      })
    );
  });

  // ── Boundary values ────────────────────────────────────────────────────

  it("BOUNDARY: rejects password exactly 7 characters (one below minimum of 8)", async () => {
    await expect(
      registerUser({ ...validRegistrationInput, password: "Pass12!" })
    ).rejects.toThrow("Password must be at least 8 characters long");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("BOUNDARY: accepts password exactly 8 characters (the minimum allowed)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ ...baseUser, emailVerified: null });
    vi.mocked(prisma.token.create).mockResolvedValue({
      id: "tok-003",
      email: baseUser.email,
      token: "uuid-token-3",
      expiresAt: new Date(Date.now() + 86_400_000),
      type: "VERIFICATION",
      createdAt: new Date(),
    });

    await expect(
      registerUser({ ...validRegistrationInput, password: "Pass123!" })
    ).resolves.toBeDefined();
  });

  it("BOUNDARY: rejects name longer than 100 characters", async () => {
    await expect(
      registerUser({ ...validRegistrationInput, name: "A".repeat(101) })
    ).rejects.toThrow("Name must not exceed 100 characters");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("BOUNDARY: accepts name exactly 100 characters (the maximum allowed)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      ...baseUser,
      name: "A".repeat(100),
      emailVerified: null,
    });
    vi.mocked(prisma.token.create).mockResolvedValue({
      id: "tok-004",
      email: baseUser.email,
      token: "uuid-token-4",
      expiresAt: new Date(Date.now() + 86_400_000),
      type: "VERIFICATION",
      createdAt: new Date(),
    });

    await expect(
      registerUser({ ...validRegistrationInput, name: "A".repeat(100) })
    ).resolves.toBeDefined();
  });

  it("BOUNDARY: rejects a malformed email address", async () => {
    await expect(
      registerUser({ ...validRegistrationInput, email: "not-an-email" })
    ).rejects.toThrow("Invalid email address format");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  // ── Failure mode 1 ─────────────────────────────────────────────────────

  it("FAILURE 1 (duplicate email): throws when the email is already registered", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser);

    await expect(registerUser(validRegistrationInput)).rejects.toThrow(
      "An account with this email already exists"
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// verifyEmail
// ---------------------------------------------------------------------------

describe("verifyEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  const validToken = {
    id: "tok-v-001",
    email: "test@example.com",
    token: "valid-uuid-token",
    expiresAt: new Date(Date.now() + 3_600_000), // 1 hour in future
    type: "VERIFICATION" as const,
    createdAt: new Date(),
  };

  // ── Happy path ─────────────────────────────────────────────────────────

  it("HAPPY PATH: marks the user email as verified and deletes the consumed token", async () => {
    vi.mocked(prisma.token.findUnique).mockResolvedValue(validToken);
    vi.mocked(prisma.user.update).mockResolvedValue(baseUser);
    vi.mocked(prisma.token.delete).mockResolvedValue(validToken);

    const result = await verifyEmail("valid-uuid-token");

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
      data: { emailVerified: expect.any(Date) },
    });
    expect(prisma.token.delete).toHaveBeenCalledWith({
      where: { token: "valid-uuid-token" },
    });
  });

  // ── Failure mode 2 ─────────────────────────────────────────────────────

  it("FAILURE 2a (token not found): throws when the token does not exist in the database", async () => {
    vi.mocked(prisma.token.findUnique).mockResolvedValue(null);

    await expect(verifyEmail("ghost-token")).rejects.toThrow(
      "Invalid or expired verification token"
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("FAILURE 2b (expired token): throws when the token's expiresAt is in the past", async () => {
    vi.mocked(prisma.token.findUnique).mockResolvedValue({
      ...validToken,
      expiresAt: new Date(Date.now() - 1), // 1 ms in the past
    });

    await expect(verifyEmail("valid-uuid-token")).rejects.toThrow(
      "Invalid or expired verification token"
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("FAILURE 2c (wrong token type): throws when the token type is not VERIFICATION", async () => {
    vi.mocked(prisma.token.findUnique).mockResolvedValue({
      ...validToken,
      type: "PASSWORD_RESET" as const,
    });

    await expect(verifyEmail("valid-uuid-token")).rejects.toThrow(
      "Invalid or expired verification token"
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// loginUser
// ---------------------------------------------------------------------------

describe("loginUser", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Happy path ─────────────────────────────────────────────────────────

  it("HAPPY PATH: returns the user and stamps lastLoginAt after successful login", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser);
    const updatedUser = { ...baseUser, lastLoginAt: new Date() };
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

    const result = await loginUser(validLoginInput);

    expect(result.email).toBe("test@example.com");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: { lastLoginAt: expect.any(Date) },
    });
  });

  it("HAPPY PATH: email lookup is case-insensitive (normalised to lowercase)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...baseUser, lastLoginAt: new Date() });

    await loginUser({ ...validLoginInput, email: "TEST@EXAMPLE.COM" });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
    });
  });

  // ── Failure mode 3 ─────────────────────────────────────────────────────

  it("FAILURE 3a (wrong password): throws generic credential error when password does not match", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser);

    await expect(
      loginUser({ ...validLoginInput, password: "WrongPassword!" })
    ).rejects.toThrow("Invalid email or password");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("FAILURE 3b (user not found): throws the same generic credential error (no enumeration)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(loginUser(validLoginInput)).rejects.toThrow(
      "Invalid email or password"
    );
  });

  it("FAILURE 3c (deactivated account): throws a clear deactivation message so the user can contact admin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      isActive: false,
    });

    await expect(loginUser(validLoginInput)).rejects.toThrow(
      "Your account has been deactivated. Contact your admin"
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("FAILURE 3d (email not verified): throws a prompt to verify email before logging in", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      emailVerified: null,
    });

    await expect(loginUser(validLoginInput)).rejects.toThrow(
      "Please verify your email"
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
