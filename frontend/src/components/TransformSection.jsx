import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Music2 } from 'lucide-react';

const TransformSection = ({
  transformData,
  processing,
  results,
  onTransformInputChange,
  onTransform,
  onKaraokeDisplay,
}) => {
  return (
    <div className="space-y-6">
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
              onChange={onTransformInputChange}
              placeholder="e.g., A song about US capitalism"
              className="mt-1"
            />
          </div>

          <Button
            onClick={onTransform}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LyricsDisplay
          title="Original Lyrics"
          lyrics={results.originalLyrics}
          onKaraokeClick={() => onKaraokeDisplay(results.originalLyrics)}
        />

        {results.transformedLyrics && (
          <LyricsDisplay
            title={processing.transforming ? "Transforming Lyrics..." : "Transformed Lyrics"}
            lyrics={results.transformedLyrics}
            loading={processing.transforming}
            onKaraokeClick={() => onKaraokeDisplay(results.transformedLyrics)}
          />
        )}
      </div>
    </div>
  );
};

const LyricsDisplay = ({ title, lyrics, loading, onKaraokeClick }) => (
  <Card className="shadow-lg">
    <CardHeader className="flex flex-row items-center justify-between">
      <CardTitle>
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin h-4 w-4" />
            {title}
          </div>
        ) : (
          title
        )}
      </CardTitle>
      <Button
        onClick={onKaraokeClick}
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
        {lyrics || "No lyrics available"}
      </pre>
    </CardContent>
  </Card>
);

export default TransformSection;