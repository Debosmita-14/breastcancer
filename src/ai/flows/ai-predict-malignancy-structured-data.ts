'use server';
/**
 * @fileOverview A Genkit flow for predicting breast cancer malignancy based on structured clinical or pathology data.
 *
 * - predictMalignancyStructuredData - A function that handles the prediction process for structured data.
 * - PredictMalignancyStructuredDataInput - The input type for the predictMalignancyStructuredData function.
 * - PredictMalignancyStructuredDataOutput - The return type for the predictMalignancyStructuredData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictMalignancyStructuredDataInputSchema = z.object({
  inputType: z.union([z.literal('clinical'), z.literal('pathology')]).describe('The type of input data provided.'),
  age: z.string().optional().describe('Patient age.'),
  tumorSize: z.string().optional().describe('Tumor size in mm.'),
  familyHistory: z.union([z.literal('yes'), z.literal('no')]).optional().describe('Family history of breast cancer.'),
  radius: z.string().optional().describe('Mean radius of the tumor cells.'),
  texture: z.string().optional().describe('Mean texture of the tumor cells.'),
  perimeter: z.string().optional().describe('Mean perimeter of the tumor cells.'),
  area: z.string().optional().describe('Mean area of the tumor cells.'),
  smoothness: z.string().optional().describe('Mean smoothness of the tumor cells.'),
  compactness: z.string().optional().describe('Mean compactness of the tumor cells.'),
  concavity: z.string().optional().describe('Mean concavity of the tumor cells.'),
  symmetry: z.string().optional().describe('Mean symmetry of the tumor cells.'),
  fractalDimension: z.string().optional().describe('Mean fractal dimension of the tumor cells.'),
});
export type PredictMalignancyStructuredDataInput = z.infer<typeof PredictMalignancyStructuredDataInputSchema>;

const PredictMalignancyStructuredDataOutputSchema = z.object({
  prediction: z.union([z.literal('Malignant'), z.literal('Benign')]).describe('The predicted malignancy status.'),
  confidence: z.number().min(0).max(1).describe('The confidence score of the prediction (0-1).'),
  featureImportance: z.array(z.object({
    feature: z.string().describe('The name of the feature.'),
    importance: z.number().min(0).max(1).describe('The importance of the feature in the prediction (0-1).'),
    value: z.string().describe('The value of the feature.'),
  })).describe('An array of features and their importance in the prediction.'),
});
export type PredictMalignancyStructuredDataOutput = z.infer<typeof PredictMalignancyStructuredDataOutputSchema>;

// New schema for the prompt, extending the input schema with boolean flags
const PredictMalignancyStructuredDataPromptInputSchema = PredictMalignancyStructuredDataInputSchema.extend({
  isClinical: z.boolean(),
  isPathology: z.boolean(),
});

export async function predictMalignancyStructuredData(input: PredictMalignancyStructuredDataInput): Promise<PredictMalignancyStructuredDataOutput> {
  return predictMalignancyStructuredDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'predictMalignancyStructuredDataPrompt',
  input: { schema: PredictMalignancyStructuredDataPromptInputSchema }, // Use the new prompt-specific schema
  output: { schema: PredictMalignancyStructuredDataOutputSchema },
  prompt: `You are an expert medical AI assistant specializing in breast cancer prediction.
Your task is to analyze the provided patient data (either clinical information or pathology measurements) and predict whether the case is "Malignant" or "Benign" for breast cancer.
You must also provide a confidence score for your prediction (between 0 and 1) and identify the top 3-5 features that were most influential in your prediction, along with their importance scores (between 0 and 1) and the input value.

Here is the patient data:

Input Type: {{{inputType}}}

{{#if isClinical}}
Clinical Information:
- Age: {{{age}}}
- Tumor Size: {{{tumorSize}}} mm
- Family History: {{{familyHistory}}}
{{/if}}

{{#if isPathology}}
Pathology Measurements (Mean values):
- Radius: {{{radius}}}
- Texture: {{{texture}}}
- Perimeter: {{{perimeter}}}
- Area: {{{area}}}
- Smoothness: {{{smoothness}}}
- Compactness: {{{compactness}}}
- Concavity: {{{concavity}}}
- Symmetry: {{{symmetry}}}
- Fractal Dimension: {{{fractalDimension}}}
{{/if}}

Consider the typical ranges and indicators for malignancy when making your prediction and assigning importance. For example, larger tumor sizes, older age, positive family history, higher radius, area, and concavity often correlate with malignancy.
Ensure that the output strictly adheres to the JSON schema provided. The 'value' field in featureImportance should be a string representation of the input value. The sum of importance scores should add up to 1 for the selected features.`,
});

const predictMalignancyStructuredDataFlow = ai.defineFlow(
  {
    name: 'predictMalignancyStructuredDataFlow',
    inputSchema: PredictMalignancyStructuredDataInputSchema,
    outputSchema: PredictMalignancyStructuredDataOutputSchema,
  },
  async (input) => {
    // Create the input for the prompt, adding the boolean flags.
    const promptInput = {
      ...input,
      isClinical: input.inputType === 'clinical',
      isPathology: input.inputType === 'pathology',
    };
    const {output} = await prompt(promptInput);
    return output!;
  }
);
