// ═══════════════════════════════════════════════════════
// GET /api/auth/me — Return current session user
// ═══════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { getSession } from "@/auth";
import { db } from "@/db";
import { users, orgs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const [org] = await db.select().from(orgs).where(eq(orgs.id, session.orgId)).limit(1);

  if (!user || !org) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      enabledPacks: org.enabledPacks,
      budgetMonthlyCents: org.budgetMonthlyCents,
      spentMonthlyCents: org.spentMonthlyCents,
    },
  });
}
