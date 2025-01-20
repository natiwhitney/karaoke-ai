import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause } from "lucide-react";

const VISIBLE_LINES = 7;
const HIGHLIGHT_POSITION = 2;
const UPDATE_INTERVAL = 50;
const LINE_INTERVAL = 3000; // Default interval for non-timed mode

export default function KaraokeDisplay({ lyrics, metadata = null, onBack }) {
  const [currentLineIndex, setCurrentLineIndex] = useState(null);
  const [startIndex, setStartIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressStartTimeRef = useRef(null);
  const progressTimerRef = useRef(null);
  const textRefs = useRef([]);

  // Validate lyrics structure and default to empty if invalid
  if (!lyrics || !Array.isArray(lyrics.lyrics)) {
    console.error("Invalid or missing lyrics data:", lyrics);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">No valid lyrics available to display</p>
      </div>
    );
  }

  const isTimedMode = lyrics.lyrics.every(
    (line) => typeof line.startTime === "number" && typeof line.endTime === "number"
  );
  const lines = lyrics.lyrics;

  const getCurrentLine = () => {
    if (
      currentLineIndex === null ||
      currentLineIndex < 0 ||
      currentLineIndex >= lines.length
    )
      return null;
    return lines[currentLineIndex];
  };

  const getLineDuration = (lineIndex) => {
    if (isTimedMode) {
      const line = lines[lineIndex];
      return line.endTime - line.startTime;
    }
    return LINE_INTERVAL; // Default duration for non-timed mode
  };

  const advanceLine = () => {
    if (currentLineIndex === null || currentLineIndex >= lines.length - 1) {
      setIsPlaying(false);
      return;
    }
    const newIndex = currentLineIndex + 1;
    if (newIndex > HIGHLIGHT_POSITION) {
      setStartIndex(newIndex - HIGHLIGHT_POSITION);
    }
    setCurrentLineIndex(newIndex);
    setProgress(0);
    progressStartTimeRef.current = Date.now();
  };

  const goBackLine = () => {
    if (currentLineIndex === null || currentLineIndex <= 0) return;

    const newIndex = currentLineIndex - 1;
    if (newIndex > HIGHLIGHT_POSITION) {
      setStartIndex(newIndex - HIGHLIGHT_POSITION);
    } else {
      setStartIndex(0);
    }
    setCurrentLineIndex(newIndex);
    setProgress(0);
    progressStartTimeRef.current = Date.now();
  };

  useEffect(() => {
    const handleKeydown = (event) => {
      if (currentLineIndex === null) return;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          advanceLine();
          break;
        case "ArrowLeft":
        case "ArrowUp":
          goBackLine();
          break;
        default:
          return;
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [currentLineIndex]);

  useEffect(() => {
    if (!isPlaying) {
      clearInterval(progressTimerRef.current);
      return;
    }

    const updateProgress = () => {
      if (!progressStartTimeRef.current) {
        progressStartTimeRef.current = Date.now();
      }

      const currentLine = getCurrentLine();
      if (!currentLine) return;

      const elapsed = Date.now() - progressStartTimeRef.current;
      const duration = getLineDuration(currentLineIndex);

      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress === 100) {
        advanceLine();
        progressStartTimeRef.current = Date.now();
        setProgress(0);
      }
    };

    progressTimerRef.current = setInterval(updateProgress, UPDATE_INTERVAL);
    return () => clearInterval(progressTimerRef.current);
  }, [isPlaying, currentLineIndex, isTimedMode]);

  useEffect(() => {
    if (!isPlaying) {
      clearInterval(progressTimerRef.current);
      return;
    }

    if (currentLineIndex === null) {
      setCurrentLineIndex(0);
      progressStartTimeRef.current = Date.now();
    }
  }, [isPlaying]);

  const togglePlayPause = () => {
    if (!isPlaying) {
      const elapsed = (progress / 100) * getLineDuration(currentLineIndex || 0);
      progressStartTimeRef.current = Date.now() - elapsed;
    }
    setIsPlaying((prev) => !prev);
  };

  const handleRestart = () => {
    clearInterval(progressTimerRef.current);
    setCurrentLineIndex(null);
    setStartIndex(0);
    setProgress(0);
    setIsPlaying(false);
    progressStartTimeRef.current = null;
  };

  const getVisibleLines = () => {
    return Array(VISIBLE_LINES)
      .fill("")
      .map((_, index) => {
        const lineIndex = startIndex + index;
        return lineIndex < lines.length ? lines[lineIndex] : null;
      });
  };

  const renderLine = (line, visibleIndex) => {
    if (!line) {
      return <div key={visibleIndex} className="h-12 flex items-center px-4" />;
    }

    const shouldHighlight =
      currentLineIndex !== null &&
      ((currentLineIndex <= HIGHLIGHT_POSITION &&
        visibleIndex === currentLineIndex) ||
        (currentLineIndex > HIGHLIGHT_POSITION &&
          visibleIndex === HIGHLIGHT_POSITION));

    const startTime = isTimedMode
      ? `${(line.startTime / 1000).toFixed(1)}s`
      : `${(visibleIndex * 3).toFixed(1)}s`;
    const endTime = isTimedMode
      ? `${(line.endTime / 1000).toFixed(1)}s`
      : `${((visibleIndex + 1) * 3).toFixed(1)}s`;

    return (
      <div
        key={visibleIndex}
        className={`h-12 flex items-center transition-all duration-500 relative ${
          shouldHighlight ? "bg-blue-100 rounded-lg px-4" : "px-4"
        }`}
      >
        <span
          ref={(el) => (textRefs.current[visibleIndex] = el)}
          className={`text-xl ${
            shouldHighlight ? "text-blue-600 font-bold" : "text-gray-600"
          }`}
        >
          {line.text}
        </span>

        <div className="ml-4 text-sm text-gray-500">
          [{startTime} - {endTime}]
        </div>

        {shouldHighlight && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute top-0 bottom-0 left-4 bg-blue-300 opacity-50"
              style={{
                width: `${(textRefs.current[visibleIndex]?.offsetWidth * progress) / 100}px`,
                maxWidth: `${textRefs.current[visibleIndex]?.offsetWidth || 0}px`,
                transition: "width 50ms linear",
              }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-teal-100 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <Card className="shadow-2xl rounded-lg border border-gray-200">
          <CardHeader className="text-center flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold text-gray-800">
                {metadata ? metadata.title : "Karaoke Display"}
              </CardTitle>
              {metadata?.artist && (
                <div className="text-sm text-gray-600">by {metadata.artist}</div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={togglePlayPause}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <Button onClick={handleRestart} variant="outline" size="sm">
                Restart
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-6 rounded-lg border mb-4">
              <div className="space-y-4 relative">
                {getVisibleLines().map((line, idx) => renderLine(line, idx))}
              </div>
            </div>

            <div className="flex justify-center mt-4">
              <Button onClick={onBack} variant="default">
                Back to Results
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}