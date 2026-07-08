import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export interface KnowledgeGraph {
  niche: string;
  toneOfVoice: string;
  keyAudiences: string[];
  topPerformanceFactors: string[];
  mainThemes: string[];
  recommendedHashtags: string[];
  suggestedHooks: string[];
}

export const generateKnowledgeGraph = async (videos: { title: string; description: string }[]): Promise<KnowledgeGraph> => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash"; // Use fast and powerful model for structured extraction

  const videosContext = videos
    .map((v, i) => `[Video ${i + 1}] Title: ${v.title}\nDescription: ${v.description.slice(0, 300)}...`)
    .join("\n\n");

  const prompt = `
    Analyze the following YouTube video titles and descriptions to build a comprehensive Content Creator Brand DNA and Knowledge Graph.
    
    Creator Videos:
    ${videosContext}
    
    You must extract and synthesize:
    1. The core niche/industry.
    2. The signature tone of voice.
    3. Primary audiences they target.
    4. Key performance and engagement drivers from their content style.
    5. Recurring main themes.
    6. Highly recommended general hashtags for their brand.
    7. Suggested viral hook patterns that suit their style.
    
    Provide your output strictly in JSON format.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          niche: { type: Type.STRING },
          toneOfVoice: { type: Type.STRING },
          keyAudiences: { type: Type.ARRAY, items: { type: Type.STRING } },
          topPerformanceFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
          mainThemes: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendedHashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedHooks: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["niche", "toneOfVoice", "keyAudiences", "topPerformanceFactors", "mainThemes", "recommendedHashtags", "suggestedHooks"],
      },
    },
  });

  return JSON.parse(response.text) as KnowledgeGraph;
};

export const generateViralSEO = async (
  youtubeUrl: string,
  context: string,
  brandProfile?: KnowledgeGraph | null
) => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash"; // Fast and highly creative

  let brandContext = "";
  if (brandProfile) {
    brandContext = `
      Grounded Brand Profile (Knowledge Graph Context):
      - Niche: ${brandProfile.niche}
      - Tone: ${brandProfile.toneOfVoice}
      - Key Audiences: ${brandProfile.keyAudiences.join(", ")}
      - Themes: ${brandProfile.mainThemes.join(", ")}
      - Top Brand Hooks: ${brandProfile.suggestedHooks.join("; ")}
    `;
  }

  const prompt = `
    Act as an elite, world-class Music Marketing Growth Hacker and SEO Specialist.
    Your mission: Create an elite, turbo-charged viral content repurposing and SEO package for a music video / video piece.
    
    Video Source Link: ${youtubeUrl}
    User-Provided Vibe/Context: ${context}
    
    ${brandContext}
    
    Generate high-converting, fully SEO-primed social media metadata blocks optimized for the algorithms of:
    - YouTube
    - YouTube Shorts
    - TikTok
    - Instagram Reels
    - Facebook Watch
    - X (formerly Twitter)
    
    Ensure descriptions are engaging, include call-to-actions (CTAs), target the correct audience psychological triggers, and are grounded in real trending, searchable keywords relevant to the content and brand profile.
    
    CRITICAL CONSTRAINT for the "keywordBank":
    - It MUST be a single string of comma-separated keywords.
    - It MUST be between 491 and 500 characters long (including commas and spaces).
    - No line breaks.
    - It must pack extremely high-value, trending music, video, and viral tags.
    
    Provide the response strictly in JSON format.
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
