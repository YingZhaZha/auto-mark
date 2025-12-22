
import { GoogleGenAI } from "@google/genai";

export const generateImageDescription = async (base64Image: string): Promise<string> => {
  try {
    // Initialize GoogleGenAI with the required named parameter and environment variable
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Remove header if present (data:image/jpeg;base64,)
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    // Use gemini-3-flash-preview for general multimodal tasks as per guidelines
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: "请用中文简短描述这张图片的内容，不超过15个字。例如：'晴朗的建筑工地' 或 '整洁的会议室'。不要包含句号。"
          }
        ]
      }
    });

    // Access the .text property directly (not a method) as per SDK specifications
    return response.text?.trim() || "AI 识别完成";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "智能识别失败";
  }
};
