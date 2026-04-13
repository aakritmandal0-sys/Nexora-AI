import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI features will not work.");
}

export const ai = new GoogleGenerativeAI(apiKey || "");

export const DEFAULT_MODEL = "gemini-2.0-flash";
export const PRO_MODEL = "gemini-1.5-pro";
