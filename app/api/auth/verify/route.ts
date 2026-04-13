import {
  MAIN_ACCESS_COOKIE_NAME,
  createMainAccessToken,
  verifyMainAccessPassword,
} from "@/lib/auth/main-access";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    const password = body.password?.trim() ?? "";

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const isValid = verifyMainAccessPassword(password);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(MAIN_ACCESS_COOKIE_NAME, createMainAccessToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error("Password verification error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
