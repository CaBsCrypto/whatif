import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// Note: process.env.GEMINI_API_KEY is handled by the platform/Vite
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface SentimentResult {
  score: number; // -1 to 1
  label: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  narrative: string;
  confidence: number;
}

export interface NarrativeRadarResult {
  topAssets: {
    symbol: string;
    potential: 'HIGH' | 'MEDIUM' | 'LOW';
    reason: string;
    tier: 1 | 2 | 3 | 4;
  }[];
  marketNarrative: string;
  globalSentiment: string;
}

export async function analyzeMarketSentiment(socialData: string): Promise<SentimentResult> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following crypto social media data and return a JSON object with:
      - score: number between -1 (extreme fear) and 1 (extreme greed)
      - label: "BULLISH", "BEARISH", or "NEUTRAL"
      - narrative: a short description of the current market narrative
      - confidence: number between 0 and 1
      
      Data: ${socialData}`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || '{}';
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Gemini Sentiment Analysis Error:", e);
    return {
      score: 0,
      label: 'NEUTRAL',
      narrative: 'Sentiment analysis unavailable or failed',
      confidence: 0
    };
  }
}

export async function getNarrativeRadar(marketData: string): Promise<NarrativeRadarResult> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Act as a crypto hedge fund analyst. Analyze the following market data and identify the top 5 assets with the highest potential based on the "Barbell Strategy" (Tier 1-4).
      Return a JSON object with:
      - topAssets: array of objects with { symbol, potential, reason, tier }
      - marketNarrative: current dominant market theme
      - globalSentiment: overall market mood
      
      Data: ${marketData}`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || '{}';
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Gemini Narrative Radar Error:", e);
    return {
      topAssets: [
        { symbol: 'SOL', potential: 'HIGH', reason: 'Core ecosystem growth', tier: 1 },
        { symbol: 'JUP', potential: 'MEDIUM', reason: 'Jupiter aggregator volume', tier: 2 },
        { symbol: 'WIF', potential: 'HIGH', reason: 'Solana meme momentum', tier: 3 }
      ],
      marketNarrative: 'Narrative analysis unavailable',
      globalSentiment: 'Neutral'
    };
  }
}
