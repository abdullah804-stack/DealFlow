import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const signupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input.",
          details: parsed.error.flatten().fieldErrors,
          requestId,
        },
      },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;
  const lower = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: lower } });
  if (existing) {
    return NextResponse.json(
      {
        error: {
          code: "EMAIL_TAKEN",
          message: "An account with this email already exists.",
          details: [],
          requestId,
        },
      },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name: name ?? null, email: lower, passwordHash },
  });

  return NextResponse.json(
    { data: { id: user.id, email: user.email }, requestId },
    { status: 201 }
  );
}