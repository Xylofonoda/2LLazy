import type { SessionOptions } from "iron-session";

export interface SessionData {
  authenticated?: boolean;
}

const sessionPassword = process.env.SESSION_PASSWORD;
if (!sessionPassword || sessionPassword.length < 32) {
  throw new Error("SESSION_PASSWORD env var must be set and at least 32 characters long.");
}

export const sessionOptions: SessionOptions = {
  cookieName: "app_session",
  password: sessionPassword,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};
