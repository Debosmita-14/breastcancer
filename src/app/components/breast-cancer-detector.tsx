'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Upload, FileText, Brain, AlertCircle, CheckCircle, Activity, Download, X, ClipboardList, RefreshCw, Copy, LogOut, Loader2, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { analyzeMammogramAction, analyzeStructuredDataAction, generateReportAction } from '@/app/actions';
import type { PredictMalignancyStructuredDataInput, PredictMalignancyStructuredDataOutput } from '@/ai/flows/ai-predict-malignancy-structured-data';
import type { AIGenerateDiagnosticReportInput } from '@/ai/flows/ai-generate-diagnostic-report-flow';

// Firebase imports
import { useUser, useFirebase } from '@/firebase';
import { initiateAnonymousSignIn, initiateEmailSignIn, initiateEmailSignUp } from '@/firebase/non-blocking-login';
import { signOut } from 'firebase/auth';
import { collection, query, getDocs, limit, serverTimestamp, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';


type Step = 'upload' | 'analyzing' | 'results';
type InputType = 'mammogram' | 'clinical' | 'pathology';
type AuthView = 'login' | 'signup';

type FormData = {
  age: string;
  tumorSize: string;
  familyHistory: 'no' | 'yes';
  radius: string;
  texture: string;
  perimeter: string;
  area: string;
  smoothness: string;
  compactness: string;
  concavity: string;
  symmetry: string;
  fractalDimension: string;
};

type Results = PredictMalignancyStructuredDataOutput & { inputType: InputType };

const clinicalFields = [
  { key: 'age', label: 'Patient Age', type: 'number', placeholder: 'e.g., 55' },
  { key: 'tumorSize', label: 'Tumor Size (mm)', type: 'number', placeholder: 'e.g., 20' },
  { key: 'familyHistory', label: 'Family History', type: 'select', options: ['no', 'yes'] as const }
];

const pathologyFeatures = [
  { key: 'radius', label: 'Mean Radius', unit: 'mm', range: '6-30' },
  { key: 'texture', label: 'Mean Texture', unit: '', range: '9-40' },
  { key: 'perimeter', label: 'Mean Perimeter', unit: 'mm', range: '40-190' },
  { key: 'area', label: 'Mean Area', unit: 'mm²', range: '140-2500' },
  { key: 'smoothness', label: 'Mean Smoothness', unit: '', range: '0.05-0.16' },
  { key: 'compactness', label: 'Mean Compactness', unit: '', range: '0.02-0.35' },
  { key: 'concavity', label: 'Mean Concavity', unit: '', range: '0-0.43' },
  { key: 'symmetry', label: 'Mean Symmetry', unit: '', range: '0.1-0.3' },
  { key: 'fractalDimension', label: 'Mean Fractal Dimension', unit: '', range: '0.05-0.1' }
];

const initialFormData: FormData = {
  age: '', tumorSize: '', familyHistory: 'no', radius: '', texture: '', perimeter: '', area: '', smoothness: '', compactness: '', concavity: '', symmetry: '', fractalDimension: ''
};

export default function BreastCancerDetector() {
  const { user, isUserLoading } = useUser();
  const { auth, firestore } = useFirebase();

  const [step, setStep] = useState<Step>('upload');
  const [inputType, setInputType] = useState<InputType>('mammogram');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [results, setResults] = useState<Results | null>(null);
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Auth state
  const [authView, setAuthView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Patient state
  const [patientId, setPatientId] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setUploadedImage(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      toast({ variant: 'destructive', title: 'Invalid File', description: 'Please upload a valid image file.' });
    }
  };

  const handleInputChange = (key: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const loadSampleData = (type: 'benign' | 'malignant') => {
    if (type === 'benign') {
      setFormData({
        age: '45', tumorSize: '15', familyHistory: 'no', radius: '12.5', texture: '18.2', perimeter: '82.3', area: '485.0', smoothness: '0.088', compactness: '0.065', concavity: '0.032', symmetry: '0.175', fractalDimension: '0.058'
      });
    } else {
      setFormData({
        age: '58', tumorSize: '32', familyHistory: 'yes', radius: '20.5', texture: '28.5', perimeter: '135.2', area: '1320.0', smoothness: '0.115', compactness: '0.245', concavity: '0.285', symmetry: '0.235', fractalDimension: '0.078'
      });
    }
    toast({ title: 'Sample Data Loaded', description: `Loaded sample data for a ${type} case.` });
  };
  
  const analyzeData = async () => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Authentication Required', description: 'You must be logged in to perform an analysis.' });
        return;
    }
    setLoading(true);
    setStep('analyzing');

    try {
      let analysisResult: PredictMalignancyStructuredDataOutput;

      if (inputType === 'mammogram' && uploadedImage) {
        analysisResult = await analyzeMammogramAction({ photoDataUri: uploadedImage });
      } else {
        const structuredInput: PredictMalignancyStructuredDataInput = {
          inputType,
          ...formData,
        };
        analysisResult = await analyzeStructuredDataAction(structuredInput);
      }

      const currentResults = { ...analysisResult, inputType };
      setResults(currentResults);
      
      const reportInput: AIGenerateDiagnosticReportInput = {
        isMalignant: currentResults.prediction === 'Malignant',
        confidence: currentResults.confidence,
        features: currentResults.featureImportance,
        inputType: currentResults.inputType,
        ...(currentResults.inputType === 'clinical' && {
            patientAge: formData.age,
            tumorSize: formData.tumorSize,
            familyHistory: formData.familyHistory,
        }),
        ...(currentResults.inputType === 'pathology' && {
            radius: formData.radius,
            area: formData.area,
            concavity: formData.concavity,
        }),
      };
      
      const generatedReport = await generateReportAction(reportInput);
      setReport(generatedReport);
      
      // Save results to Firestore
      await saveAnalysisToFirestore(currentResults, generatedReport);

      setStep('results');
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Analysis Failed', description: error instanceof Error ? error.message : 'An unknown error occurred.' });
      setStep('upload');
    } finally {
      setLoading(false);
    }
  };

  const saveAnalysisToFirestore = async (analysisResults: Results, reportContent: string) => {
    if (!user || !firestore) return;

    try {
        // Step 1: Find or create a patient
        let currentPatientId = patientId;
        if (!currentPatientId) {
            const patientCollectionRef = collection(firestore, 'users', user.uid, 'patients');
            const q = query(patientCollectionRef, limit(1));
            const patientSnapshot = await getDocs(q);

            if (patientSnapshot.empty) {
                // Create a new patient
                const newPatientData = {
                    externalUserId: user.uid,
                    name: user.email || user.uid,
                    dateOfBirth: '1970-01-01',
                    gender: 'Unknown',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };
                const patientRef = await addDocumentNonBlocking(patientCollectionRef, newPatientData);
                if (!patientRef) throw new Error("Failed to create patient record.");
                currentPatientId = patientRef.id;
            } else {
                currentPatientId = patientSnapshot.docs[0].id;
            }
            setPatientId(currentPatientId);
        }

        if (!currentPatientId) throw new Error("Patient ID could not be determined.");

        // Step 2: Create AnalysisSession
        const analysisSessionCollectionRef = collection(firestore, 'users', user.uid, 'patients', currentPatientId, 'analysisSessions');
        const analysisSessionData = {
            ownerId: user.uid,
            patientId: currentPatientId,
            analysisDate: serverTimestamp(),
            inputType: analysisResults.inputType,
            prediction: analysisResults.prediction,
            confidence: analysisResults.confidence,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const analysisSessionRef = await addDocumentNonBlocking(analysisSessionCollectionRef, analysisSessionData);
        if (!analysisSessionRef) throw new Error("Failed to save analysis session.");

        // Step 3: Create DiagnosticReport
        const reportCollectionRef = collection(analysisSessionRef, 'diagnosticReport');
        const reportData = {
            ownerId: user.uid,
            patientId: currentPatientId,
            analysisSessionId: analysisSessionRef.id,
            reportContent,
            reportGeneratedDate: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const reportRef = await addDocumentNonBlocking(reportCollectionRef, reportData);
        if (!reportRef) throw new Error("Failed to save diagnostic report.");
        
        // Step 4: Update AnalysisSession with report ID
        updateDocumentNonBlocking(doc(analysisSessionCollectionRef, analysisSessionRef.id), { diagnosticReportId: reportRef.id });

        toast({ title: 'Analysis Saved', description: 'Your analysis results have been saved to your records.' });

    } catch (error) {
        console.error("Error saving analysis to Firestore:", error);
        toast({ variant: 'destructive', title: 'Save Failed', description: error instanceof Error ? error.message : 'Could not save results to database.' });
    }
  };

  const resetApp = () => {
    setStep('upload');
    setUploadedImage(null);
    setFormData(initialFormData);
    setResults(null);
    setReport('');
    setInputType('mammogram');
  };

  const canProceed = useMemo(() => {
    if (inputType === 'mammogram') return uploadedImage !== null;
    if (inputType === 'clinical') return formData.age && formData.tumorSize;
    if (inputType === 'pathology') {
      const requiredFields = pathologyFeatures.map(f => f.key as keyof FormData);
      return requiredFields.every(field => formData[field] !== '');
    }
    return false;
  }, [inputType, uploadedImage, formData]);
  
  const downloadReport = () => {
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `InsightBreastAI-Report-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Report Downloaded" });
  };
  
  const copyReport = () => {
    navigator.clipboard.writeText(report);
    toast({ title: "Report Copied to Clipboard" });
  }

  // Auth handlers
  const handleAuthAction = async () => {
    if (!email || !password) {
        toast({ variant: 'destructive', title: 'Missing fields', description: 'Please enter both email and password.' });
        return;
    }
    setIsAuthLoading(true);
    try {
        if (authView === 'login') {
            initiateEmailSignIn(auth, email, password);
        } else {
            initiateEmailSignUp(auth, email, password);
        }
        // onAuthStateChanged will handle the rest
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Authentication Failed', description: error instanceof Error ? error.message : 'An unknown error occurred.' });
    } finally {
        setIsAuthLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setIsAuthLoading(true);
    try {
        initiateAnonymousSignIn(auth);
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Authentication Failed', description: error instanceof Error ? error.message : 'An unknown error occurred.' });
    } finally {
        setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setPatientId(null);
    resetApp();
  };

  if (isUserLoading) {
      return (
          <div className="flex h-screen w-full items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
      );
  }

  if (!user) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader>
                    <CardTitle className="text-center text-2xl font-bold">
                        Welcome to Insight Breast AI
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {authView === 'signup' && (
                            <p className="text-center text-sm text-muted-foreground">
                                Create an account to save and track your analyses.
                            </p>
                        )}
                         <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="m@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isAuthLoading} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isAuthLoading} />
                        </div>
                        <Button onClick={handleAuthAction} className="w-full" disabled={isAuthLoading}>
                            {isAuthLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {authView === 'login' ? 'Log In' : 'Sign Up'}
                        </Button>
                        <div className="relative">
                           <div className="absolute inset-0 flex items-center">
                               <span className="w-full border-t" />
                           </div>
                           <div className="relative flex justify-center text-xs uppercase">
                               <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                           </div>
                        </div>
                        <Button variant="secondary" className="w-full" onClick={handleAnonymousSignIn} disabled={isAuthLoading}>
                            {isAuthLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserIcon className="mr-2 h-4 w-4" />}
                            Anonymous Sign-In
                        </Button>
                    </div>
                    <div className="mt-4 text-center text-sm">
                        {authView === 'login' ? "Don't have an account?" : "Already have an account?"}
                        <Button variant="link" onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')} className="px-1">
                            {authView === 'login' ? 'Sign up' : 'Log in'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  }

  const renderUploadStep = () => (
    <div className="space-y-6">
      <Card className="shadow-xl border-t-4 border-primary overflow-hidden">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">1. Select Input Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['mammogram', 'clinical', 'pathology'] as const).map(type => (
              <button
                key={type}
                onClick={() => setInputType(type)}
                className={`p-6 rounded-xl border-2 transition-all text-center ${
                  inputType === type ? 'border-primary bg-primary/10 shadow-lg scale-105' : 'border-border hover:border-primary/50'
                }`}
              >
                {type === 'mammogram' && <Upload className={`w-12 h-12 mx-auto mb-3 ${inputType === type ? 'text-primary' : 'text-muted-foreground'}`} />}
                {type === 'clinical' && <ClipboardList className={`w-12 h-12 mx-auto mb-3 ${inputType === type ? 'text-primary' : 'text-muted-foreground'}`} />}
                {type === 'pathology' && <Brain className={`w-12 h-12 mx-auto mb-3 ${inputType === type ? 'text-primary' : 'text-muted-foreground'}`} />}
                <h3 className="font-semibold text-lg capitalize">{type} Data</h3>
                <p className="text-sm text-muted-foreground">
                  {type === 'mammogram' && 'AI validates & analyzes'}
                  {type === 'clinical' && 'Patient history'}
                  {type === 'pathology' && 'Tissue measurements'}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="text-2xl font-bold capitalize">
                    2. Provide {inputType} Data
                </CardTitle>
                {inputType !== 'mammogram' && (
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => loadSampleData('benign')}>Benign Sample</Button>
                    <Button variant="outline" size="sm" onClick={() => loadSampleData('malignant')}>Malignant Sample</Button>
                </div>
                )}
            </div>
        </CardHeader>
        <CardContent>
          {inputType === 'mammogram' && (
            <div>
              <Input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="imageUpload" />
              <Label htmlFor="imageUpload" className="cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/80 transition-colors bg-background">
                  {uploadedImage ? (
                    <div className="relative group max-w-md mx-auto">
                      <Image src={uploadedImage} alt="Mammogram" width={512} height={512} className="max-h-96 w-auto mx-auto rounded-lg shadow-lg" />
                      <Button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUploadedImage(null); }}
                        variant="destructive" size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium text-foreground mb-2">Click to Upload Mammogram</p>
                      <p className="text-sm text-muted-foreground">AI will validate the medical image before analysis.</p>
                    </div>
                  )}
                </div>
              </Label>
            </div>
          )}

          {inputType === 'clinical' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {clinicalFields.map(field => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  {field.type === 'select' ? (
                    <Select onValueChange={(value) => handleInputChange(field.key, value as 'no' | 'yes')} value={formData[field.key]}>
                      <SelectTrigger id={field.key}><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {field.options.map(opt => <SelectItem key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input id={field.key} type={field.type} value={formData[field.key]} onChange={(e) => handleInputChange(field.key, e.target.value)} placeholder={field.placeholder} />
                  )}
                </div>
              ))}
            </div>
          )}

          {inputType === 'pathology' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pathologyFeatures.map(feature => (
                <div key={feature.key} className="space-y-2">
                  <Label htmlFor={feature.key}>{feature.label} {feature.unit && `(${feature.unit})`}</Label>
                  <Input id={feature.key} type="number" step="any" value={formData[feature.key as keyof FormData]} onChange={(e) => handleInputChange(feature.key as keyof FormData, e.target.value)} placeholder={`Range: ${feature.range}`} />
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={analyzeData}
            disabled={!canProceed || loading}
            size="lg"
            className="w-full mt-8 text-lg"
          >
            <Brain className="w-6 h-6 mr-3" />
            Analyze with AI
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderAnalyzingStep = () => (
    <Card className="shadow-xl p-16 text-center">
      <CardContent className="flex flex-col items-center justify-center">
        <div className="relative mb-6">
          <div className="animate-spin rounded-full h-24 w-24 border-8 border-primary/20 border-t-primary mx-auto"></div>
          <Brain className="w-12 h-12 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-3">AI Analysis in Progress...</h3>
        <p className="text-muted-foreground">Processing {inputType} data, please wait.</p>
      </CardContent>
    </Card>
  );

  const renderResultsStep = () => {
    if (!results) return null;
    const isMalignant = results.prediction === 'Malignant';
    return (
      <div className="space-y-6">
          <div className="flex justify-end">
              <Button onClick={resetApp} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Start New Analysis
              </Button>
          </div>

        <Card className={`shadow-2xl p-8 border-4 ${isMalignant ? 'bg-red-500/10 border-red-400' : 'bg-green-500/10 border-green-400'}`}>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className={`p-4 rounded-2xl ${isMalignant ? 'bg-red-100' : 'bg-green-100'}`}>
              {isMalignant ? <AlertCircle className="w-16 h-16 text-red-600" /> : <CheckCircle className="w-16 h-16 text-green-600" />}
            </div>
            <div className="flex-1 w-full text-center md:text-left">
              <h2 className={`text-4xl font-bold ${isMalignant ? 'text-red-700' : 'text-green-700'}`}>{results.prediction}</h2>
              <p className="text-muted-foreground text-lg mb-4">AI Confidence: {(results.confidence * 100).toFixed(1)}%</p>
              <Progress value={results.confidence * 100} className={`h-3 ${isMalignant ? '[&>div]:bg-red-500' : '[&>div]:bg-green-500'}`} />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-xl">
            <CardHeader><CardTitle className="flex items-center gap-3"><Brain className="w-7 h-7 text-primary" />Feature Importance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {results.featureImportance.map((item, idx) => (
                <div key={idx} className="bg-background p-4 rounded-xl border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-foreground">{item.feature}</span>
                    <span className="text-xl font-bold text-primary">{(item.importance * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={item.importance * 100} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-2">Value: {String(item.value)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-3"><FileText className="w-7 h-7 text-primary" />AI Generated Report</CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={copyReport}><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={downloadReport}><Download className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-background border rounded-lg p-4 h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-sans text-foreground">{report || "Generating report..."}</pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };
  
  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-card rounded-2xl shadow-xl p-6 md:p-8 mb-6 border-t-4 border-primary">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-xl">
              <Activity className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Insight Breast AI</h1>
              <p className="text-muted-foreground mt-1">Multi-Modal Analysis with AI-Powered Insights</p>
            </div>
          </div>
          <Button onClick={handleSignOut} variant="outline">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
          </Button>
        </div>
      </div>
      
      {step === 'upload' && renderUploadStep()}
      {step === 'analyzing' && renderAnalyzingStep()}
      {step === 'results' && renderResultsStep()}
    </div>
  );
}
