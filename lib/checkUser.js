import { currentUser } from "@clerk/nextjs/server";
import { db } from "./prisma";
import { unstable_cache } from "next/cache";

// Cache user lookups for 5 minutes
const getCachedUser = unstable_cache(
  async (clerkUserId) => {
    return await db.user.findUnique({
      where: { clerkUserId },
      select: {
        id: true,
        clerkUserId: true,
        email: true,
        name: true,
        industry: true,
        experience: true,
        skills: true,
        bio: true,
        isOnboarded: true,
      },
    });
  },
  ["user"],
  { revalidate: 300 } // 5 minutes
);

export const checkUser = async () => {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  try {
    const loggedInUser = await getCachedUser(user.id);

    if (loggedInUser) {
      return loggedInUser;
    }

    const name = `${user.firstName} ${user.lastName}`;

    const newUser = await db.user.create({
      data: {
        clerkUserId: user.id,
        name,
        imageUrl: user.imageUrl,
        email: user.emailAddresses[0].emailAddress,
      },
    });

    return newUser;
  } catch (error) {
    console.log(error.message);
  }
};