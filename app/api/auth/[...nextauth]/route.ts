import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const allowedEmail = process.env.ALLOWED_EMAIL?.trim();

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    signIn: async ({ user }) => {
      if (!allowedEmail) return true;
      return user.email === allowedEmail;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.AUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
