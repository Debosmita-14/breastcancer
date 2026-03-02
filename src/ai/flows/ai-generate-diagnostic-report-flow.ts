'use server';
/**
 * @fileOverview A Genkit flow for generating a professional breast cancer diagnostic report.
 *
 * - aiGenerateDiagnosticReport - A function that generates a diagnostic report.
 * - AIGenerateDiagnosticReportInput - The input type for the aiGenerateDiagnosticReport function.
 * - AIGenerateDiagnosticReportOutput - The return type for the aiGenerateDiagnosticReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema for the public function and flow
const FeatureImportanceSchema = z.object({
  feature: z.string().describe('The name of the feature, e.g., Tumor Size.'),
  value: z.string().describe('The value of the feature, e.g., 32 mm.'),
  importance: z.number().describe('The importance of the feature as a decimal, e.g., 0.35.'),
});

const AIGenerateDiagnosticReportInputSchema = z.object({
  isMalignant: z.boolean().describe('Whether the prediction is malignant (true) or benign (false).'),
  confidence: z.number().min(0).max(1).describe('The confidence score of the prediction (0.0 to 1.0).'),
  features: z.array(FeatureImportanceSchema).describe('An array of features and their importance.'),
  inputType: z.enum(['mammogram', 'clinical', 'pathology']).describe('The type of input data used for analysis (mammogram, clinical, pathology).'),
  patientAge: z.string().optional().describe('Patient age, if inputType is clinical.'),
  tumorSize: z.string().optional().describe('Tumor size in mm, if inputType is clinical.'),
  familyHistory: z.string().optional().describe('Family history (yes/no), if inputType is clinical.'),
  radius: z.string().optional().describe('Mean radius, if inputType is pathology.'),
  area: z.string().optional().describe('Mean area, if inputType is pathology.'),
  concavity: z.string().optional().describe('Mean concavity, if inputType is pathology.'),
});

export type AIGenerateDiagnosticReportInput = z.infer<typeof AIGenerateDiagnosticReportInputSchema>;

// Output Schema for the public function and flow
const AIGenerateDiagnosticReportOutputSchema = z.string().describe('A comprehensive, professional breast cancer diagnostic report.');

export type AIGenerateDiagnosticReportOutput = z.infer<typeof AIGenerateDiagnosticReportOutputSchema>;

// Input Schema for the internal prompt, pre-processed for simplicity
const ReportPromptInputSchema = z.object({
  isMalignant: z.boolean().describe('Whether the prediction is malignant (true) or benign (false).'),
  confidencePercentage: z.string().describe('The confidence score formatted as a percentage string (e.g., "75.1%").'),
  methodDescription: z.string().describe('A description of the analysis method (e.g., "MAMMOGRAM Analysis").'),
  dataDescription: z.string().describe('A summary of the data analyzed (e.g., "CNN Deep Learning Image Analysis").'),
  formattedFeaturesList: z.string().describe('A newline-separated list of formatted features and their importance.'),
});

// Prompt definition
const reportPrompt = ai.definePrompt({
  name: 'generateDiagnosticReportPrompt',
  input: { schema: ReportPromptInputSchema },
  output: { schema: AIGenerateDiagnosticReportOutputSchema },
  model: 'googleai/gemini-pro', // Using a text-only model for report generation
  prompt: `Generate a comprehensive, professional breast cancer diagnostic report based on the following analysis results.\nEnsure the report includes clear headings for Summary, Findings, Analysis, Recommendations, Follow-up, and Disclaimers.\nMaintain a professional, empathetic, and objective tone suitable for a medical context.\n\n--- Diagnostic Summary ---\nDIAGNOSIS: {{#if isMalignant}}Malignant{{else}}Benign{{/if}}\nCONFIDENCE: {{confidencePercentage}}\nMETHOD: {{methodDescription}}\nData Analyzed: {{dataDescription}}\n\n--- Key Features and Their Importance ---\n{{formattedFeaturesList}}\n\n--- Full Report ---\nBased on the above information, generate the detailed diagnostic report below.\n`
});

// Flow definition
const aiGenerateDiagnosticReportFlow = ai.defineFlow(
  {
    name: 'aiGenerateDiagnosticReportFlow',
    inputSchema: AIGenerateDiagnosticReportInputSchema,
    outputSchema: AIGenerateDiagnosticReportOutputSchema,
  },
  async (input) => {
    // Pre-process input for the prompt
    const confidencePercentage = `${(input.confidence * 100).toFixed(1)}%`;
    const methodDescription = `${input.inputType.toUpperCase()} Analysis`;

    let dataDescription = '';
    if (input.inputType === 'mammogram') {
      dataDescription = 'CNN Deep Learning Image Analysis of a mammogram image.';
    } else if (input.inputType === 'clinical') {
      dataDescription = `Clinical patient information including Age: ${input.patientAge}, Tumor Size: ${input.tumorSize}mm, Family History: ${input.familyHistory}.`;
    } else if (input.inputType === 'pathology') {
      dataDescription = `Pathology measurements including Mean Radius: ${input.radius}, Mean Area: ${input.area}, Mean Concavity: ${input.concavity}.`;
    }

    const formattedFeaturesList = input.features.map(f =>
      `- ${f.feature}: ${f.value} (${(f.importance * 100).toFixed(1)}% contribution)`
    ).join('\n');

    const promptInput: z.infer<typeof ReportPromptInputSchema> = {
      isMalignant: input.isMalignant,
      confidencePercentage,
      methodDescription,
      dataDescription,
      formattedFeaturesList,
    };

    const { output } = await reportPrompt(promptInput);
    return output!;
  }
);

// Wrapper function
export async function aiGenerateDiagnosticReport(
  input: AIGenerateDiagnosticReportInput
): Promise<AIGenerateDiagnosticReportOutput> {
  return aiGenerateDiagnosticReportFlow(input);
}
