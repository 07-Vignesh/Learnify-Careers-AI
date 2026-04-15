"use server";

import { db } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAuthUser } from "@/lib/authHelpers";
import { inngest } from "@/lib/inngest/client";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export const generateAIInsights = async (industry) => {
  const prompt = `
          Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
          {
            "salaryRanges": [
              { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
            ],
            "growthRate": number,
            "demandLevel": "High" | "Medium" | "Low",
            "topSkills": ["skill1", "skill2"],
            "marketOutlook": "Positive" | "Neutral" | "Negative",
            "keyTrends": ["trend1", "trend2"],
            "recommendedSkills": ["skill1", "skill2"]
          }
          
          IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
          Include at least 5 common roles for salary ranges.
          Growth rate should be a percentage.
          Include at least 5 skills and trends.
        `;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

  const insights = JSON.parse(cleanedText);

  // Ensure the demandLevel is capitalized correctly
  if (insights.demandLevel) {
    insights.demandLevel = insights.demandLevel.toUpperCase();
  }

  // Ensure the marketOutlook is capitalized correctly
  if (insights.marketOutlook) {
    insights.marketOutlook = insights.marketOutlook.toUpperCase();
  }

  return insights;
};

export async function getIndustryInsights() {
  const user = await getAuthUser();

  let industryInsight = await db.industryInsight.findFirst({
    where: {
      industry: user.industry,
    },
  });

  // If no insights exist, trigger background job and return null or default data
  if (!industryInsight) {
    // ✨ TRIGGER BACKGROUND JOB - doesn't block page load
    inngest.send({
      name: "generate.industry.insights",
      data: {
        industry: user.industry,
      },
    }).catch((err) => console.error("Failed to queue insight generation:", err));

    // Return empty structure immediately so page loads fast
    return {
      industry: user.industry,
      salaryRanges: [],
      growthRate: 0,
      demandLevel: "MEDIUM",
      topSkills: [],
      marketOutlook: "NEUTRAL",
      keyTrends: [],
      recommendedSkills: [],
      nextUpdate: null,
    };
  }

  // If insights are expired, trigger refresh in background (non-blocking)
  if (new Date(industryInsight.nextUpdate) < new Date()) {
    inngest.send({
      name: "generate.industry.insights",
      data: {
        industry: user.industry,
      },
    }).catch((err) => console.error("Failed to queue insight refresh:", err));
  }

  return industryInsight;
}