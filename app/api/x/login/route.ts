import { NextResponse } from "next/server";
import {
  makeCodeChallenge,
  makeCodeVerifier,
  makeState,
  resolveCallbackUrl,
  X_AUTH_STATE_COOKIE,
  X_AUTH_VERIFIER_COOKIE,
} from "../../../../lib/x-auth";

export async function GET() {
  const clientId = process.env.X_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "X_CLIENT_ID is missing in .env.local." },
      { status: 500 },
    );
  }

  const state = makeState();
  const verifier = makeCodeVerifier();
  const challenge = makeCodeChallenge(verifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: resolveCallbackUrl(),
    scope: "tweet.read users.read offline.access",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(
    `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
  );

  response.cookies.set(X_AUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 10 * 60,
  });

  response.cookies.set(X_AUTH_VERIFIER_COOKIE, verifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
