"use server";

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/authHelpers";
import { inngest } from "@/lib/inngest/client";

export async function saveResume(content) {
  const user = await getAuthUser();

  try {
    const resume = await db.resume.upsert({
      where: {
        userId: user.id,
      },
      update: {
        content,
      },
      create: {
        userId: user.id,
        content,
      },
    });

    revalidatePath("/resume");
    return resume;
  } catch (error) {
    console.error("Error saving resume:", error.message);
    throw new Error("Failed to save resume");
  }
}

export async function getResume() {
  const user = await getAuthUser();

  return await db.resume.findUnique({
    where: {
      userId: user.id,
    },
  });
}

export async function improveWithAI({ current, type }) {
  const user = await getAuthUser();

  // Trigger background improvement - doesn't block
  inngest.send({
    name: "improve.resume.content",
    data: {
      userId: user.id,
      current,
      type,
      industry: user.industry,
    },
  }).catch((err) => console.error("Failed to queue improvement:", err));

  // Return immediately with processing message
  return {
    status: "improving",
    message: "AI is improving your content. Please wait...",
    original: current,
  };
}