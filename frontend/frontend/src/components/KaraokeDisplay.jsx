import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause } from "lucide-react";

const LINE_INTERVAL = 3000; // Time to fully display one line
const WORD_INTERVAL = 500; // Time to highlight each word
const VISIBLE_LINES = 5; // Number of lines visible

export default function KaraokeDisplay({ lyrics, onBack }) {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [visibleLines, setVisibleLines] = useState([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const lineTimerRef = useRef(null);
  const wordTimerRef = useRef(null);

  // Split lyrics into lines
  const lines = lyrics.split("\n").filter((line) => line.trim() !== "");

  useEffect(() => {
    updateVisibleLines(0);
  }, []);

  const updateVisibleLines = (startIndex) => {
    const newVisibleLines = [];
    for (let i = 0; i < VISIBLE_LINES; i++) {
      const lineIndex = startIndex + i;
      if (lineIndex < lines.length) {
        newVisibleLines.push(lines[lineIndex]);
      } else {
        newVisibleLines.push(""); // Fill empty slots at the bottom
      }
    }
    setVisibleLines(newVisibleLines);
  };

  useEffect(() => {
    if (!isPlaying) return;

    const handleLineHighlight = () => {
      const currentLine = lines[currentLineIndex];
      const words = currentLine.split(" ");

      // Highlight words one by one
      let wordIndex = 0;
      wordTimerRef.current = setInterval(() => {
        if (wordIndex < words.length) {
          setCurrentWordIndex(wordIndex);
          wordIndex++;
        } else {
          clearInterval(wordTimerRef.current);
        }
      }, WORD_INTERVAL);

      // Advance to the next line
      setTimeout(() => {
        setCurrentWordIndex(0);
        setCurrentLineIndex((prevIndex) => {
          const newIndex = prevIndex + 1;
          if (newIndex >= lines.length) {
            setIsPlaying(false); // Stop at the end
            return prevIndex;
          }

          if (newIndex >= VISIBLE_LINES) {
            updateVisibleLines(newIndex - VISIBLE_LINES + 1); // Scroll to keep line 3 highlighted
          }
          return newIndex;
        });
      }, LINE_INTERVAL);
    };

    // Start line and word timers
    lineTimerRef.current = setInterval(handleLineHighlight, LINE_INTERVAL);

    return () => {
      clearInterval(lineTimerRef.current);
      clearInterval(wordTimerRef.current);
    };
  }, [isPlaying, currentLineIndex]);

  const handleKeydown = (event) => {
    if (!isPlaying) {
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        scrollUp();
      } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        scrollDown();
      }
    }
  };

  const scrollUp = () => {
    setCurrentLineIndex((prev) => Math.max(prev - 1, 0));
    updateVisibleLines(Math.max(currentLineIndex - 1, 0));
  };

  const scrollDown = () => {
    setCurrentLineIndex((prev) => Math.min(prev + 1, lines.length - 1));
    updateVisibleLines(Math.min(currentLineIndex + 1, lines.length - VISIBLE_LINES));
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [isPlaying, currentLineIndex]);

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleRestart = () => {
    setCurrentLineIndex(0);
    setCurrentWordIndex(0);
    updateVisibleLines(0);
    setIsPlaying(true);
  };

  const renderLine = (line, index) => {
    const isHighlighted = index === currentLineIndex - (currentLineIndex >= VISIBLE_LINES - 1 ? VISIBLE_LINES - 1 : 0);

    return (
      <div
        key={index}
        className={`h-12 flex items-center transition-all duration-500 ${
          isHighlighted ? "bg-blue-100 rounded-lg px-4" : "px-4"
        }`}
      >
        {line.split(" ").map((word, wordIndex) => (
          <span
            key={wordIndex}
            className={`text-xl mx-1 transition-colors duration-200 ${
              isHighlighted && wordIndex === currentWordIndex
                ? "text-blue-600 font-bold"
                : "text-gray-600"
            }`}
          >
            {word}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-teal-100 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <Card className="shadow-2xl rounded-lg border border-gray-200">
          <CardHeader className="text-center flex flex-row items-center justify-between">
            <CardTitle className="text-3xl font-bold text-gray-800">
              Karaoke Display
            </CardTitle>
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
                {visibleLines.map((line, idx) => renderLine(line, idx))}
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