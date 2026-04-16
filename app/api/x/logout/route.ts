import { NextResponse } from "next/server";
import {
  X_ACCESS_TOKEN_COOKIE,
  X_AUTH_STATE_COOKIE,
  X_AUTH_VERIFIER_COOKIE,
  X_USERNAME_COOKIE,
} from "../../../../lib/x-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(X_ACCESS_TOKEN_COOKIE);
  response.cookies.delete(X_USERNAME_COOKIE);
  response.cookies.delete(X_AUTH_STATE_COOKIE);
  response.cookies.delete(X_AUTH_VERIFIER_COOKIE);
  return response;
}
