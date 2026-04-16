import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { X_USERNAME_COOKIE } from "../../../../lib/x-auth";

export async function GET() {
  const store = await cookies();
  const username = store.get(X_USERNAME_COOKIE)?.value;

  return NextResponse.json({
    connected: Boolean(username),
    username: username ?? null,
  });
}
