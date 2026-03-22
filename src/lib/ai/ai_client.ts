import type { AiProvider } from '../../types/story';

export const PROVIDER_BASE_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
};

/** Call Gemini SDK */
export async function callGemini(apiKey: string, modelId: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });
  const result = await model.generateContent(systemPrompt + '\n\nUser: ' + userPrompt);
  return result.response.text();
}

/** Call OpenAI-compatible API (OpenRouter, OpenAI, Custom) */
export async function callOpenAiCompatible(
  apiKey: string,
  modelId: string,
  baseUrl: string,
  systemPrompt: string,
  userPrompt: string,
  responseFormat?: 'json_object'
): Promise<string> {
  const body: any = {
    model: modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 4096,
  };

  if (responseFormat) {
    if (baseUrl.includes('api.openai.com') || baseUrl.includes('openrouter')) {
       // OpenRouter supports response_format for some models, OpenAI supports it
       body.response_format = { type: responseFormat };
    }
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Call AI Model dynamically based on provider */
export async function callAiModel(
  provider: AiProvider,
  apiKey: string,
  modelId: string,
  baseUrl: string | undefined,
  systemPrompt: string,
  userPrompt: string,
  responseFormat?: 'json_object'
): Promise<string> {
  if (provider === 'gemini') {
    // Gemini API natively returns JSON if requested in instructions, but we can't strict-enforce via 'response_format' in simple generateContent
    // We just rely on prompt for Gemini
    return callGemini(apiKey, modelId, systemPrompt, userPrompt);
  } else {
    const url = baseUrl || PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS.openai;
    return callOpenAiCompatible(apiKey, modelId, url, systemPrompt, userPrompt, responseFormat);
  }
}
