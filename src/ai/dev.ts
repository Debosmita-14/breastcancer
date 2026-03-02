import { config } from 'dotenv';
config();

import '@/ai/flows/ai-predict-malignancy-structured-data.ts';
import '@/ai/flows/ai-predict-malignancy-mammogram.ts';
import '@/ai/flows/ai-generate-diagnostic-report-flow.ts';