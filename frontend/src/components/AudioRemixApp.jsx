import React, { useState } from 'react';
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scrollArea";
import { Loader2 } from 'lucide-react';
import LyricsInput from './LyricsInput';

const LyricsAnalysis = ({ lyrics, isAnalyzing, onAnalyze, onBack, onContinue, rhymeAnalysis, structureAnalysis }) => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Analyze Lyrics</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px] w-full rounded-md border p-4">
          <pre className="whitespace-pre-wrap">{lyrics}</pre>
        </ScrollArea>
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          {!rhymeAnalysis && !structureAnalysis ? (
            <Button onClick={onAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Lyrics"
              )}
            </Button>
          ) : (
            <Button onClick={onContinue}>Continue to Transform</Button>
          )}
        </div>
      </CardContent>
    </Card>

    {(rhymeAnalysis || structureAnalysis) && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rhymeAnalysis && (
          <Card>
            <CardHeader>
              <CardTitle>Rhyme Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <pre className="text-sm">
                  {JSON.stringify(rhymeAnalysis, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {structureAnalysis && (
          <Card>
            <CardHeader>
              <CardTitle>Structure Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <pre className="text-sm">
                  {JSON.stringify(structureAnalysis, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    )}
  </div>
);

export default function AudioRemixApp() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({ artistName: '', songTitle: '' });
  const [manualLyrics, setManualLyrics] = useState('');
  const [inputMethod, setInputMethod] = useState('search');
  const [transformData, setTransformData] = useState({
    transformStyle: '',
    customPrompt: null,
  });

  const [processing, setProcessing] = useState({
    fetchingLyrics: false,
    transforming: false,
  });

  const [results, setResults] = useState({
    originalLyrics: null,
    transformedLyrics: null,
    vocalsPath: null,
    instrumentalPath: null,
    error: null
  });

  const [rhymeAnalysis, setRhymeAnalysis] = useState(null);
  const [structureAnalysis, setStructureAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [websocket, setWebsocket] = useState(null);

  const handleInputChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleManualLyricsChange = (e) => {
    setManualLyrics(e.target.value);
    setResults(prev => ({
      ...prev,
      originalLyrics: e.target.value
    }));
  };

  const handleTransformInputChange = (e) => {
    setTransformData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const setupWebSocketConnection = async () => {
    const sessionId = crypto.randomUUID();
    const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);
    
    return new Promise((resolve, reject) => {
      ws.onopen = () => {
        setWebsocket(ws);
        resolve(sessionId);
      };

      ws.onmessage = (event) => {
        const status = JSON.parse(event.data);
        
        if (status.stage === 'complete') {
          setResults(prev => ({
            ...prev,
            transformedLyrics: status.data.transformed_lyrics,
            originalLyrics: status.data.original_lyrics,
            vocalsPath: status.data.vocals_path,
            instrumentalPath: status.data.instrumental_path,
          }));
          setProcessing(prev => ({ ...prev, transforming: false }));
        } else if (status.stage === 'error') {
          setResults(prev => ({ ...prev, error: status.message }));
          setProcessing(prev => ({ ...prev, transforming: false }));
        }
      };

      ws.onerror = reject;
    });
  };

  const logApiCall = (method, url, data = null) => {
    console.group(`API Call: ${method} ${url}`);
    console.log('Request:', { method, url, data });
    return new Promise((resolve) => {
      // Log timestamp
      console.log('Time:', new Date().toISOString());
      resolve();
    });
  };

  const logApiResponse = (response, error = null) => {
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Response:', response);
    }
    console.groupEnd();
  };

  const fetchLyrics = async () => {
    setProcessing(prev => ({ ...prev, fetchingLyrics: true }));
    setResults(prev => ({ ...prev, error: null }));

    try {
      const response = await fetch('http://localhost:8000/api/fetch-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: formData.artistName,
          song_title: formData.songTitle
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      setResults(prev => ({ ...prev, originalLyrics: data.lyrics }));
      setCurrentStep(1);
    } catch (err) {
      setResults(prev => ({ ...prev, error: err.message }));
    } finally {
      setProcessing(prev => ({ ...prev, fetchingLyrics: false }));
    }
  };

  const analyzeLyrics = async () => {
    setIsAnalyzing(true);
    setResults(prev => ({ ...prev, error: null }));
    
    const url = 'http://localhost:8000/api/analyze-lyrics';
    const data = {
      lyrics: manualLyrics || results.originalLyrics
    };

    try {
      await logApiCall('POST', url, data);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const responseData = await response.json();
      logApiResponse(responseData);

      if (!response.ok) {
        throw new Error(responseData.detail || responseData.error || 'Analysis failed');
      }

      if (!responseData.rhyme_analysis || !responseData.structure_analysis) {
        throw new Error('Invalid analysis response format');
      }

      setRhymeAnalysis(responseData.rhyme_analysis);
      setStructureAnalysis(responseData.structure_analysis);
    } catch (error) {
      logApiResponse(null, error);
      const errorMessage = error.message || 'Failed to analyze lyrics';
      setResults(prev => ({ 
        ...prev, 
        error: errorMessage.includes('Failed to get valid response from LLM') 
          ? 'Analysis engine failed to process the lyrics. Please try again.'
          : errorMessage
      }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTransform = async () => {
    setProcessing(prev => ({ ...prev, transforming: true }));
    setResults(prev => ({ ...prev, error: null }));

    try {
      const sessionId = await setupWebSocketConnection();
      const url = 'http://localhost:8000/api/remix';
      const data = {
        lyrics: manualLyrics || results.originalLyrics,
        transform_style: transformData.transformStyle,
        session_id: sessionId,
        artist_name: formData.artistName || "",
        song_title: formData.songTitle || "",
        rhyme_analysis: rhymeAnalysis,
        structure_analysis: structureAnalysis
      };

      await logApiCall('POST', url, data);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const responseData = await response.json();
      logApiResponse(responseData);

      if (!response.ok) {
        throw new Error(responseData.detail || 'Transform request failed');
      }
    } catch (error) {
      logApiResponse(null, error);
      setResults(prev => ({ ...prev, error: error.message }));
      setProcessing(prev => ({ ...prev, transforming: false }));
    }
  };

  return (
    <div className="space-y-6">
      {currentStep === 0 && (
        <LyricsInput
          formData={formData}
          manualLyrics={manualLyrics}
          processing={processing}
          onInputChange={handleInputChange}
          onManualLyricsChange={handleManualLyricsChange}
          onFetchLyrics={fetchLyrics}
          onContinue={() => setCurrentStep(1)}
          inputMethod={inputMethod}
          onInputMethodChange={setInputMethod}
        />
      )}

      {currentStep === 1 && (
        <LyricsAnalysis
          lyrics={manualLyrics || results.originalLyrics}
          isAnalyzing={isAnalyzing}
          onAnalyze={analyzeLyrics}
          onBack={() => setCurrentStep(0)}
          onContinue={() => setCurrentStep(2)}
          rhymeAnalysis={rhymeAnalysis}
          structureAnalysis={structureAnalysis}
        />
      )}

      {currentStep === 2 && (
        <TransformSection
          transformData={transformData}
          processing={processing}
          results={results}
          onTransformInputChange={handleTransformInputChange}
          onTransform={handleTransform}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {results.error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{results.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
