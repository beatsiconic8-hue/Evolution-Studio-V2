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

export interface ViralAuditPackage {
  originalScore: number;
  optimizedScore: number;
  scoreChange: number;
  currentMetadata: {
    title: string;
    description: string;
    hashtags: string;
    keywords: string;
  };
  optimizedMetadata: {
    title: string;
    description: string;
    hashtags: string;
    keywords: string;
  };
  explanation: string;
}

export const generateViralAudit = async (
  title: string,
  description: string,
  brandProfile?: KnowledgeGraph | null
): Promise<ViralAuditPackage> => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash";

  let brandContext = "";
  if (brandProfile) {
    brandContext = `
      Grounded Brand Profile:
      - Niche: ${brandProfile.niche}
      - Tone: ${brandProfile.toneOfVoice}
      - Key Audiences: ${brandProfile.keyAudiences.join(", ")}
    `;
  }

  const prompt = `
    Act as an elite YouTube Audience Growth Hacker, Algorithm Engineer, and SEO Specialist powered by Mindstorm and Viral Catalyst technology.
    
    You have been supplied with the current metadata of a YouTube video:
    - Current Title: "${title}"
    - Current Description: "${description}"
    
    ${brandContext}
    
    Conduct an Elite Caliber, Turbo Social Discovery Audit. Determine:
    1. What is currently working platform-wide.
    2. What viewers are responding to well (viral psychological triggers, hook styles).
    3. What trends are hot or forecasted to blow up viral soon.
    4. Provide an original rating score out of 10 for the current metadata (where 1 is the absolute best/viral-ready, and 10 is needs immediate attention).
    5. Provide an optimized rating score out of 10 for your newly constructed metadata (where 1 is the absolute best/viral-ready).
    6. Ensure the newly constructed metadata is primed to move the needle and generate instant search & recommendation traffic.
    
    Generate:
    - A current hashtag cluster and keyword cluster derived from the original metadata.
    - An optimized Title, Description, Hashtag cluster, and Keyword cluster.
    - A brief explanation of the changes, strategic adjustments, and forecasted trend-alignment reasoning.
    
    Provide your output strictly in JSON format matching the schema.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          originalScore: { type: Type.INTEGER, description: "Score from 1 to 10 (1 is best, 10 is needs attention)" },
          optimizedScore: { type: Type.INTEGER, description: "Score from 1 to 10 (1 is best)" },
          scoreChange: { type: Type.INTEGER, description: "Relative change value, e.g. positive improvement magnitude (original - optimized)" },
          currentMetadata: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              hashtags: { type: Type.STRING, description: "Extracted hashtag cluster" },
              keywords: { type: Type.STRING, description: "Extracted comma-separated keyword cluster" },
            },
            required: ["title", "description", "hashtags", "keywords"],
          },
          optimizedMetadata: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              hashtags: { type: Type.STRING, description: "Optimized hashtag cluster" },
              keywords: { type: Type.STRING, description: "Optimized comma-separated keyword cluster" },
            },
            required: ["title", "description", "hashtags", "keywords"],
          },
          explanation: { type: Type.STRING, description: "Brief strategic explanation of the changes and why they work" },
        },
        required: ["originalScore", "optimizedScore", "scoreChange", "currentMetadata", "optimizedMetadata", "explanation"],
      },
    },
  });

  return JSON.parse(response.text) as ViralAuditPackage;
};

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

export interface TrendTopic {
  topic: string;
  searchVolume: string;
  momentum: "up" | "stable" | "down";
  explanation: string;
}

export interface TrendDashboardData {
  hotTopics: TrendTopic[];
  suggestedNicheTitles: string[];
  viralHooks: string[];
  engagementTriggers: string[];
}

export interface EngagementPrediction {
  ctrScore: number;
  retentionScore: number;
  viralityIndex: number;
  critique: string;
  recommendedHooks: string[];
  optimizedTitle: string;
}

export const generateTrendDashboardData = async (keyword: string): Promise<TrendDashboardData> => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash";

  const prompt = `
    Act as a state-of-the-art predictive social discovery model.
    Analyze the niche/keyword: "${keyword}"
    
    Predict the absolute latest real-time trends, high-velocity search queries, and viral momentum.
    Identify:
    1. 4 hot topics with predicted volume, direction of growth (up, stable, or down), and brief context of why it is trending.
    2. 3 highly optimized suggested video titles aligned with these trends.
    3. 3 highly clickable hook models for starting videos.
    4. 3 powerful audience triggers that increase viewer comments and shares (engagement drivers).
    
    Provide your output strictly in JSON format matching the schema.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hotTopics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                searchVolume: { type: Type.STRING },
                momentum: { type: Type.STRING, enum: ["up", "stable", "down"] },
                explanation: { type: Type.STRING }
              },
              required: ["topic", "searchVolume", "momentum", "explanation"]
            }
          },
          suggestedNicheTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
          viralHooks: { type: Type.ARRAY, items: { type: Type.STRING } },
          engagementTriggers: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["hotTopics", "suggestedNicheTitles", "viralHooks", "engagementTriggers"]
      }
    }
  });

  return JSON.parse(response.text) as TrendDashboardData;
};

export const predictVideoEngagement = async (title: string, thumbnailIdea: string): Promise<EngagementPrediction> => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash";

  const prompt = `
    Act as an AI YouTube Algorithm & Audience Retention Simulator.
    Analyze the following video properties:
    - Candidate Title: "${title}"
    - Thumbnail Concept: "${thumbnailIdea}"
    
    Calculate predicted performance metrics:
    1. Predicted Click-Through Rate (CTR) Score (0 to 100, where higher is more magnetic).
    2. Predicted Audience Retention/Watch-Time Score (0 to 100, based on title consistency).
    3. Predicted Virality Index (0 to 100, based on psychological triggers).
    4. Provide a critical, honest, constructive audit/critique of why this title and thumbnail works or fails, and how to maximize it.
    5. List 3 high-impact, high-retention hook patterns to use in the first 10 seconds.
    6. Provide one ultra-optimized title recommendation.
    
    Provide your output strictly in JSON format matching the schema.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          ctrScore: { type: Type.INTEGER },
          retentionScore: { type: Type.INTEGER },
          viralityIndex: { type: Type.INTEGER },
          critique: { type: Type.STRING },
          recommendedHooks: { type: Type.ARRAY, items: { type: Type.STRING } },
          optimizedTitle: { type: Type.STRING }
        },
        required: ["ctrScore", "retentionScore", "viralityIndex", "critique", "recommendedHooks", "optimizedTitle"]
      }
    }
  });

  return JSON.parse(response.text) as EngagementPrediction;
};

