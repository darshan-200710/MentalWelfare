import { randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { sanitizeUtf8Text } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "google_oauth_state";
const STATE_TTL_SECONDS = 600;

function env() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
  };
}

function loginRedirect(request: NextRequest, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("oauth_error", error);
  if (url.hostname === "0.0.0.0") url.hostname = "127.0.0.1";
  return NextResponse.redirect(url);
}

/* ─────────────────────────────────────────────────
 * GET /api/auth/google
 *
 * Redirects the user to Google's OAuth2 consent screen
 * with prompt=select_account so Google shows the native
 * account chooser (all accounts logged in on the device).
 * ───────────────────────────────────────────────── */
export async function GET(request: NextRequest) {
  const { clientId, clientSecret } = env();

  if (!clientId || !clientSecret) {
    return loginRedirect(
      request,
      "Google sign-in is not configured. Please contact your administrator."
    );
  }

  const state = randomBytes(32).toString("hex");
  const redirectUri =
    env().redirectUri ||
    new URL("/api/auth/google/callback", request.url).toString();

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  // This is the key: prompt=select_account forces Google to show
  // the account chooser even if the user is already signed in.
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}

/* ─────────────────────────────────────────────────
 * callback  (re-exported as GET from /api/auth/google/callback)
 *
 * Google redirects here with ?code=...&state=...
 * We verify the state, exchange the code for tokens,
 * fetch the user profile, upsert the user in Neon DB,
 * create a session, and redirect to the dashboard.
 * ───────────────────────────────────────────────── */
export async function callback(request: NextRequest) {
  const { clientId, clientSecret } = env();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(STATE_COOKIE)?.value;

  // ── Validate inputs ───────────────────────────
  if (!clientId || !clientSecret || !code || !state || !storedState) {
    return loginRedirect(request, "Google sign-in could not be completed.");
  }

  // ── CSRF: timing-safe state comparison ────────
  const provided = Buffer.from(state);
  const expected = Buffer.from(storedState);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return loginRedirect(request, "Google sign-in could not be verified (state mismatch).");
  }

  // ── Exchange authorization code for tokens ────
  const redirectUri =
    env().redirectUri ||
    new URL("/api/auth/google/callback", request.url).toString();

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return loginRedirect(request, "Google token exchange failed. Please try again.");
  }

  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) {
    return loginRedirect(request, "Google access token was not received.");
  }

  // ── Fetch verified Google profile ─────────────
  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileRes.ok) {
    return loginRedirect(request, "Could not fetch your Google profile.");
  }

  const profile = (await profileRes.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.email || profile.email_verified !== true) {
    return loginRedirect(request, "A verified Google email address is required.");
  }

  // ── Upsert user in Neon PostgreSQL ────────────
  const email = profile.email.toLowerCase();
  let user = await db.user.findUnique({ where: { email } });

  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: sanitizeUtf8Text(profile.name ?? "Google User"),
        passwordHash: null,
        emailVerified: true,
        status: "ACTIVE",
        role: "USER",
        onboardingComplete: false,
      },
    });
  } else {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        status: "ACTIVE",
        emailVerified: true,
      },
    });
  }

  // ── Create session & audit log ────────────────
  const sessionToken = await createSession(user.id);
  await logAudit({
    actorId: user.id,
    action: AUDIT_ACTIONS.LOGIN,
    targetType: "User",
    targetId: user.id,
    metadata: { provider: "google", googleEmail: email },
  });

  // ── Redirect to appropriate dashboard ─────────
  const destination = [
    "ADMIN",
    "SUPER_ADMIN",
    "MENTAL_HEALTH_PROFESSIONAL",
    "SUPERVISOR",
  ].includes(user.role)
    ? "/admin/personnel"
    : user.onboardingComplete
      ? "/dashboard"
      : "/assessment";

  const destUrl = new URL(destination, request.url);
  if (destUrl.hostname === "0.0.0.0") destUrl.hostname = "127.0.0.1";
  const response = NextResponse.redirect(destUrl);
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + 7 * 86400000),
  });
  response.cookies.delete(STATE_COOKIE);
  return response;
}
