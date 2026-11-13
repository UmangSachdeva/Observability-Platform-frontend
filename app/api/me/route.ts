import type { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, readAccessTokenUser } from "../../../src/lib/session";

export async function GET(request: NextRequest) {
  const user = readAccessTokenUser(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value);
  if (!user) {
    return Response.json({ error: { code: "unauthorized", message: "Please sign in." } }, { status: 401 });
  }
  const response = Response.json(user);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
