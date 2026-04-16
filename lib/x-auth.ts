import { createHash, randomBytes } from "crypto";

export const X_AUTH_STATE_COOKIE = "arcflow_x_state";
export const X_AUTH_VERIFIER_COOKIE = "arcflow_x_verifier";
export const X_ACCESS_TOKEN_COOKIE = "arcflow_x_access_token";
export const X_USERNAME_COOKIE = "arcflow_x_username";

export function makeCodeVerifier() {
  return base64Url(randomBytes(48));
}

export function makeState() {
  return base64Url(randomBytes(24));
}

export function makeCodeChallenge(verifier: string) {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export function resolveCallbackUrl() {
  return (
    process.env.X_CALLBACK_URL || "http://127.0.0.1:3000/api/x/callback"
  );
}

function base64Url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
