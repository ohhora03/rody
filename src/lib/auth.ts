import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { MEMBER_COLORS } from "@/lib/utils";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30일
  },
  pages: { signIn: "/login" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "이메일",
      credentials: {
        email: { label: "이메일", type: "email" },
        name: { label: "이름", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const colorIdx = Math.floor(Math.random() * MEMBER_COLORS.length);
        const user = await prisma.user.upsert({
          where: { email: credentials.email },
          update: {},
          create: {
            email: credentials.email,
            name: credentials.name || "새 사용자",
            color: MEMBER_COLORS[colorIdx],
          },
        });

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // 로그인 시에만 DB 조회 (이후 JWT에서 직접 읽음)
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      // 구글 로그인 시 DB upsert (로그인 1회만 실행)
      if (account?.provider === "google" && profile?.email) {
        const colorIdx = Math.floor(Math.random() * MEMBER_COLORS.length);
        const dbUser = await prisma.user.upsert({
          where: { email: profile.email },
          update: {
            name: (profile as { name?: string }).name ?? token.name as string,
            image: (profile as { picture?: string }).picture ?? undefined,
          },
          create: {
            email: profile.email,
            name: (profile as { name?: string }).name || "Google 사용자",
            color: MEMBER_COLORS[colorIdx],
            image: (profile as { picture?: string }).picture ?? undefined,
          },
        });
        token.id = dbUser.id;
        token.email = dbUser.email;
        token.name = dbUser.name;
        token.picture = dbUser.image;
      }
      return token;
    },
    // session callback은 DB 조회 없이 JWT 토큰만 사용
    // → 매 API 요청마다 DB 히트하던 문제 해결
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = (token.picture as string) ?? null;
      }
      return session;
    },
  },
};
