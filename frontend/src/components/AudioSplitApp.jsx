import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

const AudioSplitApp = () => {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [downloadedMp3, setDownloadedMp3] = useState(null);
  const [processing, setProcessing] = useState({
    downloading: false,
    splitting: false
  });
  const [isCached, setIsCached] = useState(false);
  const [audioData, setAudioData] = useState({
    vocalsPath: null,
    instrumentalPath: null
  });
  const [error, setError] = useState(null);

  const handleInputChange = useCallback((e) => {
    setYoutubeUrl(e.target.value);
    setIsCached(false);
    setDownloadedMp3(null);
    setAudioData({ vocalsPath: null, instrumentalPath: null });
  }, []);

  const handleDownload = async (e) => {
    e.preventDefault();
    setProcessing(prev => ({ ...prev, downloading: true }));
    setError(null);

    try {
      const response = await fetch("http://localhost:8000/api/download-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtube_url: youtubeUrl }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setIsCached(response.headers.get("x-cached") === "true");
      setDownloadedMp3(data.mp3Path);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(prev => ({ ...prev, downloading: false }));
    }
  };

  const handleSplit = async () => {
    setProcessing(prev => ({ ...prev, splitting: true }));
    setError(null);

    try {
      const response = await fetch("http://localhost:8000/api/split-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtube_url: youtubeUrl }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setIsCached(response.headers.get("x-cached") === "true");
      setAudioData({
        vocalsPath: data.vocalsPath,
        instrumentalPath: data.instrumentalPath
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(prev => ({ ...prev, splitting: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Input Card */}
        <Card>
          <CardHeader>
            <CardTitle>Audio Split Tool</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDownload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  YouTube URL
                </label>
                <Input
                  type="text"
                  value={youtubeUrl}
                  onChange={handleInputChange}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={processing.downloading}
                className="w-full"
              >
                {processing.downloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  "Download Audio"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Downloaded MP3 Card */}
        {downloadedMp3 && (
          <Card>
            <CardHeader>
              <CardTitle>Downloaded Audio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <audio 
                controls 
                className="w-full" 
                src={`http://localhost:8000${downloadedMp3}`}
              />
              <Button
                onClick={handleSplit}
                disabled={processing.splitting}
                className="w-full"
              >
                {processing.splitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Splitting Audio...
                  </>
                ) : (
                  "Split Audio"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Split Audio Results */}
        {audioData.vocalsPath && audioData.instrumentalPath && (
          <Card>
            <CardHeader>
              <CardTitle>Split Audio Results</CardTitle>
            </CardHeader>
            <CardContent>
              <AudioPlayer
                vocalsPath={audioData.vocalsPath}
                instrumentalPath={audioData.instrumentalPath}
              />
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default AudioSplitApp;