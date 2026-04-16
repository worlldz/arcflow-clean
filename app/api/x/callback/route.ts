import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  resolveCallbackUrl,
  X_ACCESS_TOKEN_COOKIE,
  X_AUTH_STATE_COOKIE,
  X_AUTH_VERIFIER_COOKIE,
  X_USERNAME_COOKIE,
} from "../../../../lib/x-auth";

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL("/?xAuthError=missing-client-config", request.url),
      );
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const store = await cookies();
    const savedState = store.get(X_AUTH_STATE_COOKIE)?.value;
    const verifier = store.get(X_AUTH_VERIFIER_COOKIE)?.value;

    if (!code || !state || !savedState || !verifier || state !== savedState) {
      return NextResponse.redirect(
        new URL("/?xAuthError=invalid-state", request.url),
      );
    }

    const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: resolveCallbackUrl(),
        code_verifier: verifier,
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(
        new URL("/?xAuthError=token-exchange-failed", request.url),
      );
    }

    const tokenJson = await tokenResponse.json();
    const accessToken = String(tokenJson?.access_token ?? "");

    if (!accessToken) {
      return NextResponse.redirect(
        new URL("/?xAuthError=missing-access-token", request.url),
      );
    }

    const meResponse = await fetch(
      "https://api.x.com/2/users/me?user.fields=username",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      },
    );

    if (!meResponse.ok) {
      return NextResponse.redirect(
        new URL("/?xAuthError=user-lookup-failed", request.url),
      );
    }

    const meJson = await meResponse.json();
    const username = String(meJson?.data?.username ?? "");

    if (!username) {
      return NextResponse.redirect(
        new URL("/?xAuthError=missing-username", request.url),
      );
    }

    const response = NextResponse.redirect(new URL("/", request.url));

    response.cookies.set(X_ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.set(X_USERNAME_COOKIE, username, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.delete(X_AUTH_STATE_COOKIE);
    response.cookies.delete(X_AUTH_VERIFIER_COOKIE);

    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/?xAuthError=unexpected-callback-error", request.url),
    );
  }
}
