import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

const defaultPromptPlaceholder = `You're remixing this song. Keep core patterns and motifs, but transform them into a new style.
Key remix rules:
- Preserve rhyme schemes and rhythmic structure 
- Reference recognizable phrases/themes from original, but recontextualize them
- Match syllable counts per line where possible
- Keep hooks/choruses recognizable but rewritten`;

export default function AudioRemixApp() {
  const [formData, setFormData] = useState({
    youtubeUrl: '',
    artistName: '',
    songTitle: '',
    transformStyle: ''
  });

  const [isFormCollapsed, setIsFormCollapsed] = useState(false);
  const [processing, setProcessing] = useState({
    downloading: false,
    fetchingLyrics: false,
    transforming: false,
    processingAudio: false
  });

  const [results, setResults] = useState({
    originalLyrics: null,
    transformedLyrics: null,
    vocalsPath: null,
    instrumentalPath: null,
    error: null
  });

  const [websocket, setWebsocket] = useState(null);
  const [transformStyle, setTransformStyle] = useState('');
  const [customPrompt, setCustomPrompt] = useState(null);

  useEffect(() => {
    if (results.originalLyrics) {
      setIsFormCollapsed(true);
    }
  }, [results.originalLyrics]);

  const handlePromptChange = (e) => {
    const value = e.target.value;
    setCustomPrompt(value.trim() === "" || value === defaultPromptPlaceholder ? null : value);
  };

  const handleInputChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
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
      
          if (status.stage === 'complete') {
            console.log("Complete status received:", status.data);
            setResults(prev => ({
              ...prev,
              transformedLyrics: status.data.transformed_lyrics,
              vocalsPath: status.data.vocals_path,
              instrumentalPath: status.data.instrumental_path,
            }));
            setProcessing(prev => ({ ...prev, transforming: false }));
          } else if (status.stage === 'error') {
            console.error("Error status received:", status.message);
            setResults(prev => ({ ...prev, error: status.message }));
            setProcessing(prev => ({ ...prev, transforming: false }));
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
          setResults(prev => ({ ...prev, error: "Error processing server response" }));
          setProcessing(prev => ({ ...prev, transforming: false }));
        } finally {
          ws.close();
        }
      };
      ws.onclose = () => {
        console.log("WebSocket connection closed");
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Starting submission with:", formData);
  
    // Reset the spinner and error states early
    setProcessing(prev => ({ ...prev, fetchingLyrics: true, transforming: false }));
    setResults(prev => ({ ...prev, error: null }));
  
    try {
      // Fetch lyrics
      const lyricsResponse = await fetch('http://localhost:8000/api/fetch-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: formData.artistName,
          song_title: formData.songTitle
        })
      });
  
      const lyricsData = await lyricsResponse.json();
  
      if (lyricsData.error) {
        throw new Error(lyricsData.error);
      }
  
      // Update results immediately after receiving lyrics
      setResults(prev => ({
        ...prev,
        originalLyrics: lyricsData.lyrics,
      }));
  
      // Start spinner for transforming step
      setProcessing(prev => ({
        ...prev,
        fetchingLyrics: false,
        transforming: true,
      }));
  
      // Setup WebSocket and initiate transformation
      const sessionId = await setupWebSocketConnection();
  
      const transformResponse = await fetch('http://localhost:8000/api/remix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtube_url: formData.youtubeUrl,
          artist_name: formData.artistName,
          song_title: formData.songTitle,
          transform_style: formData.transformStyle,
          custom_prompt: customPrompt,
          session_id: sessionId
        })
      });
  
      if (!transformResponse.ok) {
        throw new Error('Failed to initiate remix request');
      }
  
    } catch (error) {
      console.error('Error:', error);
      setResults(prev => ({ ...prev, error: error.message }));
      setProcessing(prev => ({
        downloading: false,
        fetchingLyrics: false,
        transforming: false,
        processingAudio: false,
      }));
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
          lyrics: results.originalLyrics, // Use original lyrics
          transform_style: transformStyle,
          custom_prompt: customPrompt,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-6">
        <Card className="shadow-2xl rounded-lg border border-gray-200">
          <CardHeader 
            className="text-center cursor-pointer flex flex-row items-center justify-between"
            onClick={() => results.originalLyrics && setIsFormCollapsed(!isFormCollapsed)}
          >
            <CardTitle className="text-3xl font-bold text-gray-800">Audio Remix Tool</CardTitle>
            {results.originalLyrics && (
              <Button variant="ghost" size="sm">
                {isFormCollapsed ? <ChevronDown /> : <ChevronUp />}
              </Button>
            )}
          </CardHeader>
          
          <CardContent>
            {/* Initial Form */}
            {(!results.originalLyrics || !isFormCollapsed) && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700">YouTube URL (Optional)</label>
                  <Input
                    name="youtubeUrl"
                    value={formData.youtubeUrl}
                    onChange={handleInputChange}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700">Artist Name</label>
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
                    <label className="block text-sm font-semibold text-gray-700">Song Title</label>
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700">Transform Style</label>
                  <Input
                    name="transformStyle"
                    value={formData.transformStyle}
                    onChange={handleInputChange}
                    placeholder="e.g., A song about US capitalism"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700">Custom LLM Prompt</label>
                  <textarea
                    name="customPrompt"
                    value={customPrompt || ""}
                    onChange={handlePromptChange}
                    rows="6"
                    placeholder={defaultPromptPlaceholder}
                    className="mt-1 w-full p-2 border rounded-md text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={Object.values(processing).some(v => v)}
                >
                  {Object.values(processing).some(v => v) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {processing.fetchingLyrics ? 'Fetching Lyrics...' : 'Processing...'}
                    </>
                  ) : (
                    'Start Processing'
                  )}
                </Button>
              </form>
            )}

            {/* Transform Controls */}
            {results.originalLyrics && (
              <div className="flex items-center gap-4 mb-6">
                <Input
                  value={transformStyle}
                  onChange={(e) => setTransformStyle(e.target.value)}
                  placeholder="Enter new transformation style..."
                  className="flex-grow"
                />
                <Button 
                  onClick={handleTransform}
                  disabled={processing.transforming}
                  className="flex items-center gap-2"
                >
                  {processing.transforming ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4" />
                      Transforming...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Transform
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        {results.originalLyrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Original Lyrics</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm">{results.originalLyrics}</pre>
              </CardContent>
            </Card>
            
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>
                  {processing.transforming ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="animate-spin h-4 w-4" />
                      Transforming Lyrics...
                    </div>
                  ) : (
                    'Transformed Lyrics'
                  )}
                </CardTitle>
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
    <pre className="whitespace-pre-wrap text-sm">{results.transformedLyrics}</pre>
  ) : (
    <p className="text-gray-500 text-sm">No transformed lyrics available yet.</p>
  )}
</CardContent>
            </Card>
          </div>
        )}

        {/* Audio Files Section */}
        {(results.vocalsPath || results.instrumentalPath) && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Audio Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.vocalsPath && (
                <div>
                  <h4 className="font-medium mb-2">Vocals</h4>
                  <audio controls className="w-full">
                    <source src={`http://localhost:8000${results.vocalsPath}`} type="audio/wav" />
                  </audio>
                </div>
              )}
              {results.instrumentalPath && (
                <div>
                  <h4 className="font-medium mb-2">Instrumental</h4>
                  <audio controls className="w-full">
                    <source src={`http://localhost:8000${results.instrumentalPath}`} type="audio/wav" />
                  </audio>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Error Alert */}
        {results.error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{results.error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}