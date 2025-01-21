import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, ListMusic } from "lucide-react";
import { API_BASE_URL, WS_BASE_URL } from '../config/api';


const LyricsPanel = ({ lyrics, loading, error, fromCache, onShowFullLyrics }) => {
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze-lyrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lyrics })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze lyrics');
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      console.error('Error analyzing lyrics:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const renderAnalysis = () => {
    if (!analysis) return null;

    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
        {/* Display song structure */}
        {analysis.structure_analysis?.verses && (
          <>
            <h3 className="font-semibold">Song Structure:</h3>
            <div className="text-sm space-y-1">
              {analysis.structure_analysis.verses.map((verse, index) => (
                <div key={index} className="flex items-center gap-2">
                  <ListMusic className="h-4 w-4" />
                  <span>{verse.name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Display rhyme scheme */}
        {analysis.rhyme_analysis?.rhyme_scheme && (
          <div className="mt-4">
            <h3 className="font-semibold">Rhyme Scheme:</h3>
            <p className="text-sm">{analysis.rhyme_analysis.rhyme_scheme}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Lyrics</CardTitle>
          <div className="space-x-2">
            {lyrics && !analyzing && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAnalyze}
              >
                <FileText className="mr-2 h-4 w-4" />
                Analyze
              </Button>
            )}
            {lyrics && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onShowFullLyrics}
              >
                Expand
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            <div>Loading lyrics...</div>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : lyrics ? (
          <>
            <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg max-h-[400px] overflow-y-auto">
              {lyrics}
            </pre>
            {fromCache && (
              <p className="text-sm text-gray-500 mt-2">Loaded from cache</p>
            )}
            {renderAnalysis()}
          </>
        ) : (
          <div className="text-center py-4">No lyrics available</div>
        )}
      </CardContent>
    </Card>
  );
};

export default LyricsPanel;