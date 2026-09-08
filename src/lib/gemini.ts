import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = "gemini-3.6-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되어 있지 않아요.");
  }
  return new GoogleGenAI({ apiKey });
}

/** 판정은 매번 같은 결론이 나와야 하므로 온도를 낮게 둔다. */
export async function generateJson(prompt: string, temperature = 0.2): Promise<unknown> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: { responseMimeType: "application/json", temperature },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini가 빈 응답을 반환했어요.");

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Gemini 응답을 해석할 수 없어요.");
  }
}
