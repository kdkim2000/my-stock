import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

function getAllowedEmails(): string[] {
  const single = process.env.ALLOWED_EMAIL?.trim();
  if (single) return [single];
  const multi = process.env.ALLOWED_EMAILS?.trim();
  if (multi) return multi.split(",").map((e) => e.trim()).filter(Boolean);
  return [];
}

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    signIn: ({ user }) => {
      const email = user?.email;
      if (!email) return false;
      const allowed = getAllowedEmails();
      if (allowed.length === 0) return false;
      return allowed.includes(email);
    },
    jwt: ({ token, user }) => {
      if (user?.email) token.email = user.email;
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) session.user.email = token.email ?? session.user.email;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.AUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
