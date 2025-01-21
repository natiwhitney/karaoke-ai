import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Split } from "lucide-react";

const AudioSection = ({
  isCheckingFiles,
  splitResults,
  mp3Path,
  isSplitting,
  onSplit,
  onSearchVideos,
  isSearching,
  buildAudioUrl
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audio</CardTitle>
      </CardHeader>
      <CardContent>
        {isCheckingFiles ? (
          <div className="text-center py-4">Checking for existing files...</div>
        ) : splitResults.vocalsPath && splitResults.instrumentalPath ? (
          <audio controls className="w-full">
            <source
              src={splitResults.vocalsPath && buildAudioUrl(splitResults.vocalsPath)}
              type="audio/mpeg"
            />
          </audio>
        ) : mp3Path ? (
          <div className="space-y-4">
            <audio controls className="w-full">
              <source src={mp3Path && buildAudioUrl(mp3Path)} type="audio/mpeg" />
            </audio>
            <Button onClick={onSplit} disabled={isSplitting} className="w-full">
              {isSplitting ? (
                <>
                  <Split className="mr-2 h-4 w-4 animate-spin" />
                  Splitting Audio...
                </>
              ) : (
                <>
                  <Split className="mr-2 h-4 w-4" />
                  Split Audio Tracks
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button onClick={onSearchVideos} disabled={isSearching}>
            {isSearching ? "Searching..." : "Find Audio"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default AudioSection;