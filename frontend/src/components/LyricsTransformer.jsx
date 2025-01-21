import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, Wand2, Clock, Download } from "lucide-react";
import { API_BASE_URL, WS_BASE_URL } from '../config/api';


const LyricsTransformer = ({ originalLyrics, artistName, songTitle }) => {
  const [transformStyle, setTransformStyle] = useState('');
  const [transformedLyrics, setTransformedLyrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [versions, setVersions] = useState([]);

  // Fetch existing versions on mount
  useEffect(() => {
    fetchVersions();
  }, [artistName, songTitle]);

  const fetchVersions = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/lyrics/versions/${encodeURIComponent(artistName)}/${encodeURIComponent(songTitle)}`
      );
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error('Error fetching versions:', error);
    }
  };

  const handleTransform = async () => {
    if (!originalLyrics || !transformStyle) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/remix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyrics: originalLyrics,
          transform_style: transformStyle,
          artist_name: artistName,
          song_title: songTitle,
          session_id: crypto.randomUUID()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to transform lyrics');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // Refresh versions list after successful transformation
      await fetchVersions();
      setTransformStyle('');

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Transform Lyrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Transform Style
            </label>
            <Input
              placeholder="e.g., A song about US capitalism"
              value={transformStyle}
              onChange={(e) => setTransformStyle(e.target.value)}
              disabled={loading}
            />
          </div>

          <Button 
            onClick={handleTransform} 
            disabled={!originalLyrics || !transformStyle || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transforming...
              </>
            ) : (
              'Transform Lyrics'
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Versions Display */}
      {versions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transformed Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {versions.map((version) => (
                <div 
                  key={version.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{version.style}</h3>
                      <p className="text-sm text-gray-500 flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {new Date(version.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Open lyrics in new tab or download
                        window.open(`/api/lyrics/download/${version.id}`, '_blank');
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg max-h-[200px] overflow-y-auto">
                    {version.lyrics}
                  </pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LyricsTransformer;