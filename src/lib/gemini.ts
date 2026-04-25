import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const generateViralSEO = async (youtubeUrl: string, context: string) => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";

  const prompt = `
    Act as a world-class Music Marketing Growth Hacker and SEO Specialist.
    Your mission: Create a turbo-charged viral SEO package for a music video.
    
    YouTube Link: ${youtubeUrl}
    Artist/Song Context: ${context}
    
    Generate high-converting metadata for: Facebook, Instagram, X (Twitter), TikTok, YouTube, and YouTube Shorts.
    Each platform must have its own tailored strategy based on its unique algorithm.
    
    CRITICAL CONSTRAINT for the "keywordBank":
    - It MUST be a single string of comma-separated keywords.
    - It MUST be between 491 and 500 characters long (including commas and spaces).
    - No line breaks.
    - It should be packed with high-value, trending music and viral keywords.
    
    Return the response in JSON format.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          youtube: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              hashtags: { type: Type.STRING },
            },
            required: ["title", "description", "hashtags"],
          },
          shorts: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              caption: { type: Type.STRING },
              hashtags: { type: Type.STRING },
            },
            required: ["title", "caption", "hashtags"],
          },
          tiktok: {
            type: Type.OBJECT,
            properties: {
              hook: { type: Type.STRING },
              caption: { type: Type.STRING },
              hashtags: { type: Type.STRING },
            },
            required: ["hook", "caption", "hashtags"],
          },
          instagram: {
            type: Type.OBJECT,
            properties: {
              caption: { type: Type.STRING },
              hashtags: { type: Type.STRING },
            },
            required: ["caption", "hashtags"],
          },
          facebook: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              hashtags: { type: Type.STRING },
            },
            required: ["title", "description", "hashtags"],
          },
          x: {
            type: Type.OBJECT,
            properties: {
              post: { type: Type.STRING },
              hashtags: { type: Type.STRING },
            },
            required: ["post", "hashtags"],
          },
          keywordBank: {
            type: Type.STRING,
            description: "A comma-separated list of keywords, exactly 491-500 characters long.",
          },
        },
        required: ["youtube", "shorts", "tiktok", "instagram", "facebook", "x", "keywordBank"],
      },
    },
  });

  return JSON.parse(response.text);
};
