import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Try to get user from local session cookie
    const cookies = parseCookieHeader(opts.req.headers.cookie || "");
    const sessionCookie = cookies[COOKIE_NAME];
    
    if (sessionCookie) {
      // Parse the session cookie to get user ID
      // Format: userId:username (simple format)
      const [userIdStr] = sessionCookie.split(":");
      const userId = parseInt(userIdStr);
      
      if (!isNaN(userId)) {
        const foundUser = await db.getUserById(userId);
        if (foundUser) {
          user = foundUser;
        }
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
