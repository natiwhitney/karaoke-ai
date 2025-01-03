import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, ChevronDown, ChevronUp, RefreshCw, Music2, ArrowRight } from 'lucide-react';
import KaraokeDisplay from './KaraokeDisplay';

const defaultPromptPlaceholder = `You're remixing this song. Keep core patterns and motifs, but transform them into a new style.
Key remix rules:
- Preserve rhyme schemes and rhythmic structure 
- Keep callouts like [Chorus], [Verse], etc. in place.
- Reference recognizable phrases/themes from original, but recontextualize them
- Match syllable counts per line where possible
- Keep hooks/choruses recognizable but rewritten`;

const STEPS = {
  FETCH_LYRICS: 0,
  TRANSFORM: 1
};

const preprocessLyrics = (rawLyrics) => {
  if (!rawLyrics) {
    console.error("No lyrics provided");
    return null;
  }

  const lines = rawLyrics.split("\n").filter((line) => line.trim() !== "");
  return {
    lyrics: lines.map((line, index) => ({
      text: line,
      startTime: index * 3000, // Assign a default start time (3 seconds per line)
      endTime: (index + 1) * 3000, // Assign a default end time
    })),
  };
};

const updateLibrary = async () => {
  try {
    const response = await fetch('http://localhost:8000/api/library');
    const data = await response.json();
    console.log("Library updated:", data);
  } catch (error) {
    console.error('Error updating library:', error);
  }
};

export default function AudioRemixApp() {
  const [currentStep, setCurrentStep] = useState(STEPS.FETCH_LYRICS);
  const [formData, setFormData] = useState({
    artistName: '',
    songTitle: '',
  });

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

  const [lyrics, setLyrics] = useState('');
  const [websocket, setWebsocket] = useState(null);
  const [karaokeMode, setKaraokeMode] = useState(false);
  const [selectedLyrics, setSelectedLyrics] = useState(null);
  const [isLyricsModalOpen, setIsLyricsModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');

  const handleInputChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleTransformInputChange = (e) => {
    setTransformData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleKaraokeDisplay = (rawLyrics) => {
    const processedLyrics = preprocessLyrics(rawLyrics);
    console.log("Processed Lyrics:", processedLyrics); // Debug log
    if (processedLyrics && processedLyrics.lyrics.length > 0) {
      setSelectedLyrics(processedLyrics);
      setKaraokeMode(true);
    } else {
      console.error("Invalid or empty lyrics data after preprocessing");
    }
  };

  const handleBackFromKaraoke = () => {
    setKaraokeMode(false);
    setSelectedLyrics(null);
  };

  const setupWebSocketConnection = () => {
    return new Promise((resolve, reject) => {
      const sessionId = crypto.randomUUID();
      console.log(`Creating WebSocket connection for session ${sessionId}`);
      
      const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);
  
      ws.onopen = () => {
        console.log("WebSocket connection established");
        setWebsocket(ws);
        resolve(sessionId);
      };
  
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setResults(prev => ({ ...prev, error: "WebSocket connection error" }));
        setProcessing(prev => ({ ...prev, transforming: false }));
        ws.close();
        reject(error);
      };

      ws.onmessage = (event) => {
        console.log("Raw WebSocket message:", event.data);
        try {
          const status = JSON.parse(event.data);
          
          switch (status.stage) {
            case 'complete':
              console.log("Complete status received:", status.data);
              setResults(prev => ({
                ...prev,
                transformedLyrics: status.data.transformed_lyrics,
                originalLyrics: status.data.original_lyrics,
                vocalsPath: status.data.vocals_path,
                instrumentalPath: status.data.instrumental_path,
              }));
              setProcessing(prev => ({ ...prev, transforming: false }));
              break;

            case 'transform':
              console.log("Transform progress:", status.progress);
              break;

            case 'error':
              console.error("Error status received:", status.message);
              setResults(prev => ({ ...prev, error: status.message }));
              setProcessing(prev => ({ ...prev, transforming: false }));
              break;

            default:
              console.log("Status update:", status);
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
          setResults(prev => ({ ...prev, error: "Error processing server response" }));
          setProcessing(prev => ({ ...prev, transforming: false }));
        }
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed");
      };
    });
  };

  const fetchLyrics = async () => {
    console.log("Fetching lyrics for:", formData); // Debug log
    setLyrics(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch('http://localhost:8000/api/fetch-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: formData.artistName,
          song_title: formData.songTitle
        })
      });

      console.log("Raw response:", response); // Debug log
      const data = await response.json();
      console.log("Lyrics response data:", data); // Debug log

      if (data.error) throw new Error(data.error);
      
      // Check if lyrics property exists in response
      if (!data.lyrics) {
        throw new Error('No lyrics in response');
      }

      const fromCache = response.headers.get('x-cached') === 'true';
      console.log("From cache:", fromCache); // Debug log

      setLyrics(data.lyrics);
      await updateLibrary();

    } catch (err) {
      console.error("Error fetching lyrics:", err); // Debug log
      setResults({ error: err.message });
    }
  };

  const handleTransform = async () => {
    if (!results.originalLyrics) return;

    setProcessing(prev => ({ ...prev, transforming: true }));
    setResults(prev => ({ ...prev, error: null }));

    try {
      const sessionId = await setupWebSocketConnection();

      const transformResponse = await fetch('http://localhost:8000/api/remix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyrics: results.originalLyrics,
          transform_style: transformData.transformStyle,
          custom_prompt: transformData.customPrompt,
          session_id: sessionId
        })
      });

      if (!transformResponse.ok) {
        throw new Error('Transform request failed');
      }

    } catch (error) {
      console.error('Transform error:', error);
      setResults(prev => ({ ...prev, error: error.message }));
      setProcessing(prev => ({ ...prev, transforming: false }));
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setProcessing((prev) => ({ ...prev, fetchingLyrics: true }));
    fetchLyrics()
      .then(() => {
        setCurrentStep(STEPS.TRANSFORM);
      })
      .catch((err) => {
        console.error("Error fetching lyrics:", err);
      })
      .finally(() => {
        setProcessing((prev) => ({ ...prev, fetchingLyrics: false }));
      });
  };

  if (karaokeMode && selectedLyrics) {
    return <KaraokeDisplay lyrics={selectedLyrics} onBack={handleBackFromKaraoke} />;
  }

  return (
    <div>
      {currentStep === STEPS.FETCH_LYRICS && (
        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Step 1: Get Song Lyrics</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700">
                    Artist Name
                  </label>
                  <Input
                    name="artistName"
                    value={formData.artistName}
                    onChange={handleInputChange}
                    placeholder="Artist name"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700">
                    Song Title
                  </label>
                  <Input
                    name="songTitle"
                    value={formData.songTitle}
                    onChange={handleInputChange}
                    placeholder="Song title"
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={processing.fetchingLyrics}
              >
                {processing.fetchingLyrics ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching Lyrics...
                  </>
                ) : (
                  <>
                    Get Lyrics
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {currentStep === STEPS.TRANSFORM && (
        <>
          <Card className="shadow-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">Step 2: Transform Lyrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Transform Style
                </label>
                <Input
                  name="transformStyle"
                  value={transformData.transformStyle}
                  onChange={handleTransformInputChange}
                  placeholder="e.g., A song about US capitalism"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Custom Prompt (Optional)
                </label>
                <textarea
                  name="customPrompt"
                  value={transformData.customPrompt || ""}
                  onChange={handleTransformInputChange}
                  rows="6"
                  placeholder={defaultPromptPlaceholder}
                  className="mt-1 w-full p-2 border rounded-md text-sm"
                />
              </div>

              <Button
                onClick={handleTransform}
                disabled={processing.transforming}
                className="w-full"
              >
                {processing.transforming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transforming...
                  </>
                ) : (
                  "Transform Lyrics"
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => setCurrentStep(STEPS.FETCH_LYRICS)}
                className="w-full mt-2"
              >
                Back to Step 1
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Original Lyrics</CardTitle>
                <Button
                  onClick={() => handleKaraokeDisplay(results.originalLyrics)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Music2 className="h-4 w-4" />
                  Display Lyrics
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm">
                  {results.originalLyrics || "No lyrics available"}
                </pre>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  {processing.transforming ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="animate-spin h-4 w-4" />
                      Transforming Lyrics...
                    </div>
                  ) : (
                    "Transformed Lyrics"
                  )}
                </CardTitle>
                {results.transformedLyrics && (
                  <Button
                    onClick={() => handleKaraokeDisplay(results.transformedLyrics)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Music2 className="h-4 w-4" />
                    Display Lyrics
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {processing.transforming ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                    <div className="text-center space-y-4">
                      <Loader2 className="animate-spin h-8 w-8 mx-auto" />
                      <p>Crafting new lyrics...</p>
                    </div>
                  </div>
                ) : results.transformedLyrics ? (
                  <pre className="whitespace-pre-wrap text-sm">
                    {results.transformedLyrics}
                  </pre>
                ) : (
                  <p className="text-gray-500 text-sm">
                    No transformed lyrics available yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {results.error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{results.error}</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
