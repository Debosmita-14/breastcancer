'use server';
/**
 * @fileOverview A Genkit flow for predicting breast cancer malignancy from a mammogram image.
 * This flow takes a mammogram image (as a data URI), uses an AI model to analyze visual patterns,
 * and returns a prediction of malignancy, a confidence score, and key feature importance.
 *
 * - aiPredictMalignancyMammogram - A function that handles the mammogram analysis process.
 * - PredictMalignancyMammogramInput - The input type for the aiPredictMalignancyMammogram function.
 * - PredictMalignancyMammogramOutput - The return type for the aiPredictMalignancyMammogram function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema
const PredictMalignancyMammogramInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A mammogram image, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type PredictMalignancyMammogramInput = z.infer<typeof PredictMalignancyMammogramInputSchema>;

// Output Schema
const PredictMalignancyMammogramOutputSchema = z.object({
  prediction: z.enum(['Malignant', 'Benign']).describe('The AI\'s prediction for breast cancer malignancy.'),
  confidence: z.number().min(0).max(1).describe('The confidence level of the prediction (0-1).'),
  featureImportance: z.array(z.object({
    feature: z.string().describe('The name of the visual feature analyzed (e.g., Mass Density, Calcification).'),
    importance: z.number().min(0).max(1).describe('The importance weight of this feature in the prediction (0-1).'),
    value: z.string().describe('The detected value or characteristic of the feature (e.g., Detected, Clustered, Irregular).'),
  })).describe('A list of visual features and their importance in the prediction.'),
});
export type PredictMalignancyMammogramOutput = z.infer<typeof PredictMalignancyMammogramOutputSchema>;

// Wrapper function for the Genkit flow
export async function aiPredictMalignancyMammogram(
  input: PredictMalignancyMammogramInput
): Promise<PredictMalignancyMammogramOutput> {
  return aiPredictMalignancyMammogramFlow(input);
}

// Define the prompt for mammogram analysis
const predictMalignancyMammogramPrompt = ai.definePrompt({
  name: 'predictMalignancyMammogramPrompt',
  input: {schema: PredictMalignancyMammogramInputSchema},
  output: {schema: PredictMalignancyMammogramOutputSchema},
  prompt: `You are an expert AI assistant specializing in the analysis of mammogram images for breast cancer detection.
Your task is to analyze the provided mammogram image, identify visual patterns indicative of malignancy, and provide a prediction along with confidence and key feature importance.

Analyze the following mammogram image:
Mammogram Image: {{media url=photoDataUri}}

Based on your analysis, determine if the case is 'Malignant' or 'Benign'.
Provide a confidence score for your prediction (between 0 and 1).
Identify up to 4 key visual features from the mammogram that influenced your decision, detailing their name, importance (0-1), and detected value/characteristic.
Examples of features include "Mass Density", "Calcification", "Margin Definition", "Tissue Architecture", "Lesion Shape", "Spiculation", etc.`,
});

// Define the Genkit flow for mammogram analysis
const aiPredictMalignancyMammogramFlow = ai.defineFlow(
  {
    name: 'aiPredictMalignancyMammogramFlow',
    inputSchema: PredictMalignancyMammogramInputSchema,
    outputSchema: PredictMalignancyMammogramOutputSchema,
  },
  async (input) => {
    const {output} = await predictMalignancyMammogramPrompt(input);
    if (!output) {
      throw new Error('Failed to get output from mammogram analysis prompt.');
    }
    return output;
  }
);
