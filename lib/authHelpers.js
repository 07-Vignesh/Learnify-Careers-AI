"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "./prisma";
import { unstable_cache } from "next/cache";

// Get authenticated user with minimal database queries
export const getAuthUser = async (includeRelations = false) => {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const cacheKey = includeRelations ? "user-with-relations" : "user";

  const getUserFromDb = unstable_cache(
    async (clerkUserId) => {
      if (includeRelations) {
        return await db.user.findUnique({
          where: { clerkUserId },
          include: {
            resume: true,
            coverLetters: true,
            industryInsight: true,
            quizResults: true,
          },
        });
      }
      return await db.user.findUnique({
        where: { clerkUserId },
      });
    },
    [cacheKey],
    { revalidate: 300 } // 5 minutes
  );

  const user = await getUserFromDb(userId);
  if (!user) throw new Error("User not found");

  return user;
};
