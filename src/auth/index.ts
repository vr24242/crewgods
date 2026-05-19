// ═══════════════════════════════════════════════════════
// AUTH — JWT session management + middleware
// Uses HTTP-only cookies for the dashboard, Bearer
// tokens for the API. Google OAuth for login.
// ═══════════════════════════════════════════════════════

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { db } from "../db";
import { users, orgs } from "../db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "crewgods-dev-secret-change-me");
const TOKEN_EXPIRY = "7d";

export interface SessionPayload extends JWTPayload {
  userId: string;
  orgId: string;
  email: string;
  role: string;
}

// ── Create a signed JWT ──────────────────────────────

export async function createSession(user: {
  id: string;
  orgId: string;
  email: string;
  role: string;
}): Promise<string> {
  return new SignJWT({
    userId: user.id,
    orgId: user.orgId,
    email: user.email,
    role: user.role,
  } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

// ── Verify and decode a JWT ──────────────────────────

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// ── Get session from request (Next.js) ───────────────

export async function getSession(request: Request): Promise<SessionPayload | null> {
  // Try Authorization header first (API)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return verifySession(authHeader.slice(7));
  }

  // Try cookie (dashboard)
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [key, ...val] = c.trim().split("=");
        return [key, val.join("=")];
      })
    );
    if (cookies.session) {
      return verifySession(cookies.session);
    }
  }

  return null;
}

// ── Find or create user from OAuth ───────────────────

export async function findOrCreateUser(profile: {
  email: string;
  name: string;
  avatarUrl?: string;
}) {
  // Check if user exists
  const existing = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
  if (existing.length > 0) {
    return existing[0];
  }

  // Create org + user for new signups
  const [org] = await db.insert(orgs).values({
    name: profile.name + "'s Org",
    slug: profile.email.split("@")[0] + "-" + Date.now().toString(36),
    enabledPacks: [],
  }).returning();

  const [user] = await db.insert(users).values({
    orgId: org.id,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    role: "owner",
  }).returning();

  return user;
}

// ── Require auth middleware (for API routes) ──────────

export function requireAuth(handler: (req: Request, session: SessionPayload) => Promise<Response>) {
  return async (req: Request) => {
    const session = await getSession(req);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return handler(req, session);
  };
}
