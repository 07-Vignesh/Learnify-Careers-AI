"use server";

import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/authHelpers";
import { inngest } from "@/lib/inngest/client";

export async function generateQuiz() {
  const user = await getAuthUser();

  // Trigger background job - doesn't block
  inngest.send({
    name: "generate.interview.quiz",
    data: {
      userId: user.id,
      industry: user.industry,
      skills: user.skills || [],
    },
  }).catch((err) => console.error("Failed to queue quiz generation:", err));

  // Return immediately to unblock UI
  return {
    status: "generating",
    message: "Your quiz is being generated. It will appear here shortly.",
  };
}

export async function saveQuizResult(questions, answers, score) {
  const user = await getAuthUser();

  const questionResults = questions.map((q, index) => ({
    question: q.question,
    answer: q.correctAnswer,
    userAnswer: answers[index],
    isCorrect: q.correctAnswer === answers[index],
    explanation: q.explanation,
  }));

  // Get wrong answers
  const wrongAnswers = questionResults.filter((q) => !q.isCorrect);

  // Trigger background job to generate improvement tip if there are wrong answers
  if (wrongAnswers.length > 0) {
    inngest.send({
      name: "generate.improvement.tip",
      data: {
        userId: user.id,
        industry: user.industry,
        wrongAnswers,
      },
    }).catch((err) => console.error("Failed to queue improvement tip:", err));
  }

  try {
    const assessment = await db.assessment.create({
      data: {
        userId: user.id,
        quizScore: score,
        questions: questionResults,
        category: "Technical",
        improvementTip: wrongAnswers.length > 0 ? "Analyzing your performance..." : null,
      },
    });

    return assessment;
  } catch (error) {
    console.error("Error saving quiz result:", error);
    throw new Error("Failed to save quiz result");
  }
}

export async function getAssessments() {
  const user = await getAuthUser();

  try {
    const assessments = await db.assessment.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return assessments;
  } catch (error) {
    console.error("Error fetching assessments:", error);
    throw new Error("Failed to fetch assessments");
  }
}