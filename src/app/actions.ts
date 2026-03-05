'use server';

import { 
  predictMalignancyStructuredData, 
  type PredictMalignancyStructuredDataInput,
  type PredictMalignancyStructuredDataOutput 
} from '@/ai/flows/ai-predict-malignancy-structured-data';
import { 
  aiPredictMalignancyMammogram, 
  type PredictMalignancyMammogramInput,
  type PredictMalignancyMammogramOutput 
} from '@/ai/flows/ai-predict-malignancy-mammogram';
import { 
  aiGenerateDiagnosticReport, 
  type AIGenerateDiagnosticReportInput 
} from '@/ai/flows/ai-generate-diagnostic-report-flow';

export async function analyzeMammogramAction(
  input: PredictMalignancyMammogramInput
): Promise<PredictMalignancyMammogramOutput> {
  if (!input.photoDataUri || !input.photoDataUri.startsWith('data:image/')) {
    throw new Error('Invalid image data URI provided.');
  }
  try {
    const result = await aiPredictMalignancyMammogram(input);
    return result;
  } catch (error) {
    console.error("Error in analyzeMammogramAction:", error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    throw new Error(`Failed to analyze the mammogram image: ${message}`);
  }
}

export async function analyzeStructuredDataAction(
  input: PredictMalignancyStructuredDataInput
): Promise<PredictMalignancyStructuredDataOutput> {
   try {
    const result = await predictMalignancyStructuredData(input);
    return result;
  } catch (error) {
    console.error("Error in analyzeStructuredDataAction:", error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    throw new Error(`Failed to analyze the provided data: ${message}`);
  }
}

export async function generateReportAction(
  input: AIGenerateDiagnosticReportInput
): Promise<string> {
  try {
    const report = await aiGenerateDiagnosticReport(input);
    return report;
  } catch (error) {
    console.error("Error in generateReportAction:", error);
    // Return a fallback report in case of API failure
    return fallbackReport(input);
  }
}

// Fallback function in case the AI report generation fails
function fallbackReport(input: AIGenerateDiagnosticReportInput): string {
    const { isMalignant, confidence, features, inputType } = input;
    const date = new Date().toLocaleDateString();
    return `BREAST CANCER DIAGNOSTIC REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Date: ${date} | ID: BC-${Date.now()}
Analysis: ${inputType.toUpperCase()}

FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Classification: ${isMalignant ? '⚠️ MALIGNANT' : '✓ BENIGN'}
Confidence: ${(confidence * 100).toFixed(1)}%

Key Features:
${features.map((f, i) => `${i + 1}. ${f.feature}: ${f.value} (${(f.importance * 100).toFixed(1)}% contribution)`).join('\n')}

RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${isMalignant ? '⚠️ URGENT: Oncology referral is strongly recommended for further evaluation.\n• A biopsy may be required for definitive diagnosis.\n• Discussion with a specialist for treatment planning is advised.' : '✓ ROUTINE: Continue with regular screening as advised by your healthcare provider.\n• Maintain a healthy lifestyle and perform regular self-examinations.\n• No immediate follow-up is indicated based on this analysis.'}

DISCLAIMER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ This is a preliminary AI-driven analysis and should not be considered a definitive medical diagnosis. It is intended for informational and screening purposes only.
Consult with qualified healthcare professionals for a final diagnosis and any medical advice.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  };
