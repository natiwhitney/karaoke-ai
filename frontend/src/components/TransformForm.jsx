import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Music2 } from 'lucide-react';

const TransformForm = ({
  transformData,
  handleTransformInputChange,
  handleTransform,
  processing,
  setCurrentStep,
  results,
  handleKaraokeDisplay,
}) => {
  const [inputMethod, setInputMethod] = useState('search');
  const [searchData, setSearchData] = useState({
    artist: '',
    songTitle: '',
  });
  const [manualLyrics, setManualLyrics] = useState('');
  const [error, setError] = useState(null);

  const handleSearchInputChange = (e) => {
    const { name, value } = e.target;
    setSearchData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const fetchLyrics = async () => {
    try {
      setError(null);
      const response = await fetch("http://localhost:8000/api/fetch-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist: searchData.artist,
          song_title: searchData.songTitle
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Update results with fetched lyrics
      results.originalLyrics = data.lyrics;
      
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Step 1: Input Lyrics</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="search" onValueChange={setInputMethod}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search">Search Song</TabsTrigger>
              <TabsTrigger value="manual">Manual Input</TabsTrigger>
            </TabsList>
            
            <TabsContent value="search" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Artist Name
                  </label>
                  <Input
                    name="artist"
                    value={searchData.artist}
                    onChange={handleSearchInputChange}
                    placeholder="Enter artist name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Song Title
                  </label>
                  <Input
                    name="songTitle"
                    value={searchData.songTitle}
                    onChange={handleSearchInputChange}
                    placeholder="Enter song title"
                  />
                </div>
                <Button 
                  onClick={fetchLyrics}
                  disabled={!searchData.artist || !searchData.songTitle}
                  className="w-full"
                >
                  Search Lyrics
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="manual" className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter Lyrics Manually
                </label>
                <Textarea
                  value={manualLyrics}
                  onChange={(e) => {
                    setManualLyrics(e.target.value);
                    results.originalLyrics = e.target.value;
                  }}
                  placeholder="Paste or type lyrics here..."
                  className="min-h-[200px]"
                />
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {(results.originalLyrics || manualLyrics) && (
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
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {(results.originalLyrics || results.transformedLyrics) && (
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

          {results.transformedLyrics && (
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
                <Button
                  onClick={() => handleKaraokeDisplay(results.transformedLyrics)}
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
                  {results.transformedLyrics}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default TransformForm;