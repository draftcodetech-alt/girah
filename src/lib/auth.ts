import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getFreshAccount } from "@/lib/account-guard";
import { isRateLimited, recordFailure, resetRateLimit } from "@/lib/rate-limit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" }, // Credentials provider requires JWT — technical-design.md Decisions Log #15
  // Without this, Auth.js rejects every request on self-hosted production
  // (NODE_ENV=production, no AUTH_URL) — and login() then reports success
  // without ever setting a session cookie (Phase 1 C3).
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Phase 4 L1: normalize at the choke point too — the login form
        // lowercases via its schema, but a raw /api/auth call may not.
        const email = (credentials.email as string).trim().toLowerCase();

        // Phase 4 M3: key by email+IP so one attacker IP can't spray accounts
        // and a single account can't absorb unlimited guesses. Rejected before
        // any DB work; success clears the budget below.
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown";
        const rateKey = `${email}|${ip}`;
        if (isRateLimited(rateKey)) {
          return null;
        }

        // Phase 4 L1: case-insensitive match so legacy mixed-case rows keep
        // working while new writes are stored lowercase.
        const user = await db.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });

        if (!user) {
          recordFailure(rateKey);
          return null;
        }

        if (!user.isActive) {
          // Same generic failure as any other invalid login — never reveal
          // that this specific account exists and is disabled.
          recordFailure(rateKey);
          return null;
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValidPassword) {
          recordFailure(rateKey);
          return null;
        }

        resetRateLimit(rateKey);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in — seed the token from the freshly authenticated user.
        token.id = user.id;
        token.role = (user as { role: "CUSTOMER" | "ADMIN" }).role;
        token.sessionVersion =
          (user as { sessionVersion?: number }).sessionVersion ?? 0;
        return token;
      }

      // Every subsequent session read: re-check the account so a disable or
      // session-version bump takes effect IMMEDIATELY instead of surviving in
      // a stale JWT for up to 30 days (Phase 1 C2). Returning null makes
      // Auth.js drop the session cookie entirely.
      if (typeof token.id !== "string") return null;
      const account = await getFreshAccount(token.id);
      if (
        !account ||
        !account.isActive ||
        account.sessionVersion !== (token.sessionVersion ?? 0)
      ) {
        return null;
      }
      token.role = account.role;
      // Phase 4 L6: refresh profile fields on every read so a rename or
      // email change (done elsewhere) doesn't live in a stale JWT up to 30d.
      token.name = account.name;
      token.email = account.email;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "CUSTOMER" | "ADMIN";
      }
      return session;
    },
  },
});
