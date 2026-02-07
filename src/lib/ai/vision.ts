import { createXai } from '@ai-sdk/xai';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { AIImageAnalysis } from '@/types';

// Lazy initialization to avoid build-time errors
function getXai() {
  if (!process.env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY is not configured');
  }
  return createXai({
    apiKey: process.env.XAI_API_KEY,
  });
}

const imageAnalysisSchema = z.object({
  detected_type: z.string().optional().describe('Type of equipment detected (e.g., "semi-truck", "flatbed trailer", "excavator")'),
  detected_make: z.string().optional().describe('Manufacturer if identifiable'),
  detected_model: z.string().optional().describe('Model if identifiable'),
  damage_detected: z.boolean().describe('Whether visible damage is detected'),
  damage_areas: z.array(z.string()).optional().describe('Areas where damage is visible'),
  quality_score: z.number().min(0).max(1).describe('Image quality score from 0 to 1'),
  suggested_tags: z.array(z.string()).describe('Relevant tags for the listing'),
  is_valid_equipment_photo: z.boolean().describe('Whether this is a valid photo of trucks/trailers/equipment'),
});

export async function analyzeImage(imageUrl: string): Promise<AIImageAnalysis> {
  const xai = getXai();

  const { object } = await generateObject({
    model: xai('grok-2-vision-1212'),
    schema: imageAnalysisSchema,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this image for a truck/trailer/equipment marketplace listing.

Identify:
1. What type of equipment is shown (truck, trailer, heavy equipment, etc.)
2. The manufacturer/make if visible
3. The model if identifiable
4. Any visible damage (dents, rust, wear, etc.)
5. Image quality (lighting, focus, angle)
6. Relevant tags for searchability

This is for AxlonAI, a marketplace similar to TruckPaper for commercial vehicles and equipment.`,
          },
          {
            type: 'image',
            image: imageUrl,
          },
        ],
      },
    ],
  });

  return {
    detected_type: object.detected_type,
    detected_make: object.detected_make,
    detected_model: object.detected_model,
    damage_detected: object.damage_detected,
    damage_areas: object.damage_areas,
    quality_score: object.quality_score,
    suggested_tags: object.suggested_tags,
    is_valid_equipment_photo: object.is_valid_equipment_photo,
  };
}

export async function generateListingDescription(
  imageUrls: string[],
  specs: Record<string, unknown>
): Promise<string> {
  const xai = getXai();

  const { object } = await generateObject({
    model: xai('grok-2-vision-1212'),
    schema: z.object({
      description: z.string().describe('Professional listing description'),
    }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Generate a professional listing description for this truck/trailer/equipment based on the images and specifications provided.

Specifications: ${JSON.stringify(specs, null, 2)}

Write a compelling, informative description that:
1. Highlights key features visible in the photos
2. Mentions the specifications naturally
3. Uses professional marketplace language
4. Is 2-3 paragraphs long
5. Mentions condition based on what's visible
6. Avoids making false claims`,
          },
          ...imageUrls.slice(0, 4).map((url) => ({
            type: 'image' as const,
            image: url,
          })),
        ],
      },
    ],
  });

  return object.description;
}
