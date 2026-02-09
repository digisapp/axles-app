import { logger } from '@/lib/logger';

const XAI_API_BASE = 'https://api.x.ai/v1';

function getApiKey(): string {
  if (!process.env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY is not configured');
  }
  return process.env.XAI_API_KEY;
}

export async function startVideoGeneration(
  imageUrl: string,
  prompt: string
): Promise<{ request_id: string }> {
  const apiKey = getApiKey();

  const response = await fetch(`${XAI_API_BASE}/videos/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-imagine-video',
      prompt,
      image_url: imageUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('xAI video generation start failed', { status: response.status, error });
    throw new Error(`xAI video generation failed: ${response.status}`);
  }

  const data = await response.json();
  return { request_id: data.request_id };
}

export async function getVideoResult(
  requestId: string
): Promise<{ status: 'pending' | 'completed' | 'failed'; url?: string }> {
  const apiKey = getApiKey();

  const response = await fetch(`${XAI_API_BASE}/videos/${requestId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('xAI video result check failed', { status: response.status, error });
    throw new Error(`xAI video result check failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.status === 'completed' && data.url) {
    return { status: 'completed', url: data.url };
  }

  if (data.status === 'failed') {
    return { status: 'failed' };
  }

  return { status: 'pending' };
}
