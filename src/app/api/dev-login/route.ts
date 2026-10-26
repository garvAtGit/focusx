import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Forbidden in production", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const redirectUrl = searchParams.get("redirect") || "/admin/machines";

  const response = NextResponse.redirect(new URL(redirectUrl, request.url));
  response.cookies.set("dev_admin", "true", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 86400,
  });

  return response;
}
