import { db } from "../prisma";
import { inngest } from "./client";
import mentors from "@/data/mentors";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export const generateIndustryInsights = inngest.createFunction(
  { name: "Generate Industry Insights" },
  { cron: "0 0 * * 0" }, // Run every Sunday at midnight
  async ({ step }) => {
    const industries = await step.run("Fetch industries", async () => {
      return await db.industryInsight.findMany({
        select: { industry: true },
      });
    });

    for (const { industry } of industries) {
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


      const res = await step.ai.wrap(
        "gemini",
        async (p) => {
          return await model.generateContent(p);
        },
        prompt
      );
      

      const text = res.response.candidates[0].content.parts[0].text || "";
      const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

      const insights = JSON.parse(cleanedText);

      await step.run(`Update ${industry} insights`, async () => {
        await db.industryInsight.update({
          where: { industry },
          data: {
            ...insights,
            lastUpdated: new Date(),
            nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      });
    }
  }
);

// Background job to generate insights for a specific industry
export const generateIndustryInsightsOnDemand = inngest.createFunction(
  { name: "Generate Industry Insights On Demand" },
  { event: "generate.industry.insights" },
  async ({ event, step }) => {
    const { industry } = event.data;

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

    const insights = await step.run("Generate AI insights", async () => {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
      const parsed = JSON.parse(cleanedText);

      // Capitalize correctly
      if (parsed.demandLevel) {
        parsed.demandLevel = parsed.demandLevel.toUpperCase();
      }
      if (parsed.marketOutlook) {
        parsed.marketOutlook = parsed.marketOutlook.toUpperCase();
      }

      return parsed;
    });

    await step.run("Save insights to database", async () => {
      await db.industryInsight.upsert({
        where: { industry },
        update: {
          ...insights,
          nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        create: {
          industry,
          ...insights,
          nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });

    return { success: true, industry };
  }
);

// Background job to generate cover letters
export const generateCoverLetterBackground = inngest.createFunction(
  { name: "Generate Cover Letter Background" },
  { event: "generate.cover.letter" },
  async ({ event, step }) => {
    const { coverLetterId, userId, jobTitle, companyName, jobDescription } = event.data;

    const user = await step.run("Fetch user data", async () => {
      return await db.user.findUnique({
        where: { id: userId },
        select: { industry: true, experience: true, skills: true, bio: true },
      });
    });

    const content = await step.run("Generate cover letter with AI", async () => {
      const prompt = `
        Write a professional cover letter for a ${jobTitle} position at ${companyName}.
        
        About the candidate:
        - Industry: ${user.industry}
        - Years of Experience: ${user.experience}
        - Skills: ${user.skills?.join(", ")}
        - Professional Background: ${user.bio}
        
        Job Description:
        ${jobDescription}
        
        Requirements:
        1. Use a professional, enthusiastic tone
        2. Highlight relevant skills and experience
        3. Show understanding of the company's needs
        4. Keep it concise (max 400 words)
        5. Use proper business letter formatting in markdown
        6. Include specific examples of achievements
        7. Relate candidate's background to job requirements
        
        Format the letter in markdown.
      `;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    });

    await step.run("Save cover letter", async () => {
      await db.coverLetter.update({
        where: { id: coverLetterId },
        data: {
          content,
          status: "completed",
        },
      });
    });

    return { success: true, coverLetterId };
  }
);

// Background job to generate interview quiz
export const generateInterviewQuizBackground = inngest.createFunction(
  { name: "Generate Interview Quiz Background" },
  { event: "generate.interview.quiz" },
  async ({ event, step }) => {
    const { userId, industry, skills } = event.data;

    const questions = await step.run("Generate quiz questions with AI", async () => {
      const prompt = `
        Generate 10 technical interview questions for a ${industry} professional${
          skills?.length ? ` with expertise in ${skills.join(", ")}` : ""
        }.
        
        Each question should be multiple choice with 4 options.
        
        Return the response in this JSON format only, no additional text:
        {
          "questions": [
            {
              "question": "string",
              "options": ["string", "string", "string", "string"],
              "correctAnswer": "string",
              "explanation": "string"
            }
          ]
        }
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
      const quiz = JSON.parse(cleanedText);
      return quiz.questions;
    });

    // Note: Store in assessment or a new quiz session if needed
    // For now, we'll just return success
    return { success: true, userId, questionCount: questions.length };
  }
);

// Background job to improve resume content
export const improveResumeContentBackground = inngest.createFunction(
  { name: "Improve Resume Content Background" },
  { event: "improve.resume.content" },
  async ({ event, step }) => {
    const { userId, current, type, industry } = event.data;

    const improvedContent = await step.run("Improve content with AI", async () => {
      const prompt = `
        As an expert resume writer, improve the following ${type} description for a ${industry} professional.
        Make it more impactful, quantifiable, and aligned with industry standards.
        Current content: "${current}"

        Requirements:
        1. Use action verbs
        2. Include metrics and results where possible
        3. Highlight relevant technical skills
        4. Keep it concise but detailed
        5. Focus on achievements over responsibilities
        6. Use industry-specific keywords
        
        Format the response as a single paragraph without any additional text or explanations.
      `;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    });

    // Store improvement in a way you can retrieve it (e.g., in a suggestions table)
    // For now, we'll log it and you can extend the schema to store suggestions
    console.log(`Improvement for ${type}:`, improvedContent);

    return { success: true, userId, type, improvedContent };
  }
);

// Background job to generate improvement tips for quiz results
export const generateImprovementTip = inngest.createFunction(
  { name: "Generate Improvement Tip" },
  { event: "generate.improvement.tip" },
  async ({ event, step }) => {
    const { userId, industry, wrongAnswers } = event.data;

    const tip = await step.run("Generate improvement tip with AI", async () => {
      const wrongQuestionsText = wrongAnswers
        .map(
          (q) =>
            `Question: "${q.question}"\nCorrect Answer: "${q.answer}"\nUser Answer: "${q.userAnswer}"`
        )
        .join("\n\n");

      const prompt = `
        The user got the following ${industry} technical interview questions wrong:

        ${wrongQuestionsText}

        Based on these mistakes, provide a concise, specific improvement tip.
        Focus on the knowledge gaps revealed by these wrong answers.
        Keep the response under 2 sentences and make it encouraging.
        Don't explicitly mention the mistakes, instead focus on what to learn/practice.
      `;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    });

    // Get the latest assessment and update with the tip
    await step.run("Update assessment with tip", async () => {
      const latestAssessment = await db.assessment.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      if (latestAssessment) {
        await db.assessment.update({
          where: { id: latestAssessment.id },
          data: { improvementTip: tip },
        });
      }
    });

    return { success: true, userId, tip };
  }
);

// Background job to match mentors
export const matchMentorsBackground = inngest.createFunction(
  { name: "Match Mentors Background" },
  { event: "match.mentors" },
  async ({ event, step }) => {
    const { userId, studentProfile } = event.data;

    const matches = await step.run("Match mentors with AI", async () => {
      const prompt = `
You are an expert AI career mentor matcher.

STUDENT PROFILE:
${JSON.stringify(studentProfile, null, 2)}

AVAILABLE MENTORS:
${JSON.stringify(mentors, null, 2)}

TASK:
1. Write a short professional summary of the student.
2. Select the TOP 2–3 most suitable mentors.
3. For EACH selected mentor:
   - Assign a matchScore (0–100) based on skills, interests, and goals alignment
   - Explain clearly why this mentor is relevant
   - Give 2–3 actionable career growth suggestions

Rules:
- Match scores must be realistic and justified
- Do not select more than 3 mentors

Return ONLY valid JSON:
{
  "studentSummary": "string",
  "matches": [
    {
      "mentorId": "string",
      "matchScore": number,
      "reason": "string",
      "careerSuggestions": ["string"]
    }
  ]
}
`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleaned = text.replace(/```json|```/g, "").trim();
      return JSON.parse(cleaned);
    });

    // Store matches in database or cache for user to retrieve
    // For now, log it - you can add a table to store mentor matches
    console.log(`Mentor matches for user ${userId}:`, matches);

    return { success: true, userId, matches };
  }
);