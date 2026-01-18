import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Ensure API key is available
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

/**
 * Encodes a File object to Base64.
 */
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Analyzes an image using Gemini.
 */
export const analyzeImage = async (file: File): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash-image';
    const imagePart = await fileToGenerativePart(file);

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          imagePart,
          { text: "Detailed description of this image for accessibility and metadata purposes. Keep it concise but descriptive." }
        ]
      },
    });

    return response.text || "No description generated.";
  } catch (error) {
    console.error("Gemini Image Analysis Error:", error);
    throw new Error("Failed to analyze image with AI.");
  }
};

/**
 * Transcribes or summarizes audio using Gemini.
 */
export const processAudio = async (file: File): Promise<string> => {
  try {
    // Using the specialized model for audio if available, or flash-latest
    const model = 'gemini-2.5-flash-latest'; 
    const audioPart = await fileToGenerativePart(file);

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          audioPart,
          { text: "Please transcribe the spoken content of this audio file. If it's music, describe the genre and mood." }
        ]
      },
    });

    return response.text || "No transcript generated.";
  } catch (error) {
    console.error("Gemini Audio Processing Error:", error);
    throw new Error("Failed to process audio with AI.");
  }
};
