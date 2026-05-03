import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { MEMBER_COLORS } from "@/lib/utils";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
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
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      // 구글 로그인 시 DB에 유저 upsert
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
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        // 세션 유저가 DB에 없으면 자동 복구
        const exists = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { id: true },
        });
        if (!exists && token.email) {
          const colorIdx = Math.floor(Math.random() * MEMBER_COLORS.length);
          const newUser = await prisma.user.upsert({
            where: { email: token.email as string },
            update: {},
            create: {
              email: token.email as string,
              name: (token.name as string) || "사용자",
              color: MEMBER_COLORS[colorIdx],
            },
          });
          token.id = newUser.id;
        }
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
