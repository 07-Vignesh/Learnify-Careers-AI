"use server";

import { inngest } from "@/lib/inngest/client";
import { getAuthUser } from "@/lib/authHelpers";

export async function matchMentors(studentProfile) {
  const user = await getAuthUser();

  // Trigger background mentor matching - doesn't blocka
  inngest.send({
    name: "match.mentors",
    data: {
      userId: user.id,
      studentProfile,
    },
  }).catch((err) => console.error("Failed to queue mentor matching:", err));

  // Return immediately
  return {
    status: "matching",
    message: "Finding the best mentors for you...",
  };
}
