import React from 'react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from 'lucide-react';

const LyricsInput = ({
  formData,
  manualLyrics,
  processing,
  onInputChange,
  onManualLyricsChange,
  onFetchLyrics,
  onContinue,
  inputMethod,
  onInputMethodChange
}) => {
  return (
    <Card className="shadow-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Step 1: Input Lyrics</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="search" onValueChange={onInputMethodChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">Search Song</TabsTrigger>
            <TabsTrigger value="manual">Manual Input</TabsTrigger>
          </TabsList>
          
          <TabsContent value="search" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Artist Name
                </label>
                <Input
                  name="artistName"
                  value={formData.artistName}
                  onChange={onInputChange}
                  placeholder="Enter artist name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Song Title
                </label>
                <Input
                  name="songTitle"
                  value={formData.songTitle}
                  onChange={onInputChange}
                  placeholder="Enter song title"
                />
              </div>
            </div>
            <Button 
              onClick={onFetchLyrics}
              disabled={!formData.artistName || !formData.songTitle || processing.fetchingLyrics}
              className="w-full"
            >
              {processing.fetchingLyrics ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                "Search Lyrics"
              )}
            </Button>
          </TabsContent>
          
          <TabsContent value="manual" className="space-y-4">
            <Textarea
              value={manualLyrics}
              onChange={onManualLyricsChange}
              placeholder="Paste or type lyrics here..."
              className="min-h-[200px]"
            />
            <Button 
              onClick={onContinue}
              disabled={!manualLyrics.trim()}
              className="w-full"
            >
              Continue to Transform
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default LyricsInput;