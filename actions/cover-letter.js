"use server";

import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/authHelpers";
import { inngest } from "@/lib/inngest/client";

export async function generateCoverLetter(data) {
  const user = await getAuthUser();

  // Create pending cover letter immediately
  const coverLetter = await db.coverLetter.create({
    data: {
      content: "Generating your cover letter...",
      jobDescription: data.jobDescription,
      companyName: data.companyName,
      jobTitle: data.jobTitle,
      status: "generating",
      userId: user.id,
    },
  });

  // Trigger background job - doesn't block
  inngest.send({
    name: "generate.cover.letter",
    data: {
      coverLetterId: coverLetter.id,
      userId: user.id,
      jobTitle: data.jobTitle,
      companyName: data.companyName,
      jobDescription: data.jobDescription,
    },
  }).catch((err) => console.error("Failed to queue cover letter generation:", err));

  // Return immediately with pending status
  return coverLetter;
}

export async function getCoverLetters() {
  const user = await getAuthUser();

  return await db.coverLetter.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getCoverLetter(id) {
  const user = await getAuthUser();

  return await db.coverLetter.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });
}

export async function deleteCoverLetter(id) {
  const user = await getAuthUser();

  return await db.coverLetter.delete({
    where: {
      id,
      userId: user.id,
    },
  });
}