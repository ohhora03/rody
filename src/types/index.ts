import type {
  User,
  Family,
  FamilyMember,
  Project,
  Sprint,
  Issue,
  Comment,
  FamilyRole,
  SprintStatus,
  IssueStatus,
  Priority,
} from "@prisma/client";

export type {
  User,
  Family,
  FamilyMember,
  Project,
  Sprint,
  Issue,
  Comment,
  FamilyRole,
  SprintStatus,
  IssueStatus,
  Priority,
};

export type FamilyMemberWithUser = FamilyMember & { user: User };
export type FamilyWithMembers = Family & { members: FamilyMemberWithUser[] };

export type ActivityEntry = Comment & {
  author: User;
};

export type IssueWithRelations = Issue & {
  assignee: User | null;
  reviewer: User | null;
  creator: User | null;
  comments: ActivityEntry[];
  sprint: Sprint | null;
};

export type SprintWithIssues = Sprint & { issues: IssueWithRelations[] };
export type ProjectWithSprints = Project & { sprints: Sprint[] };

export type BurndownPoint = { date: string; remaining: number | null; ideal: number };

export type Member = { id: string; name: string; color: string; email?: string };

declare module "next-auth" {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  }
}
