import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User } from "./types";
import { prisma } from "./db";
import { sendVerificationEmail } from "./email";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<User> {
  const { email, name, password } = input;

  // Validation boundary checks
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email address format");
  }
  if (name.length > 100) {
    throw new Error("Name must not exceed 100 characters");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  const normalizedEmail = email.toLowerCase();

  // Check unique email
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    throw new Error("An account with this email already exists");
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Perform database creation and email dispatch
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name,
      passwordHash,
      role: "CSM",
      isActive: true,
    },
  });

  const tokenValue = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.token.create({
    data: {
      email: normalizedEmail,
      token: tokenValue,
      expiresAt,
      type: "VERIFICATION",
    },
  });

  await sendVerificationEmail(user.email, tokenValue);

  return user as unknown as User;
}

export async function verifyEmail(token: string): Promise<{ success: boolean }> {
  const tokenRecord = await prisma.token.findUnique({
    where: { token },
  });

  if (
    !tokenRecord ||
    tokenRecord.type !== "VERIFICATION" ||
    tokenRecord.expiresAt < new Date()
  ) {
    throw new Error("Invalid or expired verification token");
  }

  await prisma.user.update({
    where: { email: tokenRecord.email },
    data: { emailVerified: new Date() },
  });

  await prisma.token.delete({
    where: { token },
  });

  return { success: true };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<User> {
  const { email, password } = input;
  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordMatch) {
    throw new Error("Invalid email or password");
  }

  if (!user.isActive) {
    throw new Error("Your account has been deactivated. Contact your admin");
  }

  if (!user.emailVerified) {
    throw new Error("Please verify your email");
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return updatedUser as unknown as User;
}
