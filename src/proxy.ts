import { NextRequest, NextResponse } from "next/server";
import { USER_ID_COOKIE } from "@/lib/constants";

/** 회원가입 없이 "내 감시"만 구분하려고 익명 ID를 쿠키로 발급한다. */
export function proxy(request: NextRequest) {
  if (request.cookies.get(USER_ID_COOKIE)?.value) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set(USER_ID_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365 * 2,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
