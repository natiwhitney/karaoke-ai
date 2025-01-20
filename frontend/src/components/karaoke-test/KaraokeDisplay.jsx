import React, { useState, useEffect, useRef } from 'react';

const VISIBLE_LINES = 5;    // Number of lines visible
const HIGHLIGHT_POSITION = 2; // Position where highlighting occurs (0-based index)

export default function KaraokeDisplay({ 
  lyrics, 
  onBack,
  lineInterval = 3000,      // Time to highlight each line
  scrollDuration = 500      // Duration of scroll animation
}) {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [visibleLines, setVisibleLines] = useState([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef(null);

  // Split lyrics into lines and filter out empty ones
  const lines = lyrics.split("\n").filter(line => line.trim() !== "");

  // Initialize visible lines
  useEffect(() => {
    updateVisibleLines(currentLineIndex);
  }, []);

  const updateVisibleLines = (startIndex) => {
    const newVisibleLines = [];
    for (let i = 0; i < VISIBLE_LINES; i++) {
      const lineIndex = startIndex + i;
      if (lineIndex < lines.length) {
        newVisibleLines.push({
          text: lines[lineIndex],
          index: lineIndex,
          isHighlighted: false
        });
      } else {
        newVisibleLines.push({ text: "", index: lineIndex, isHighlighted: false });
      }
    }
    setVisibleLines(newVisibleLines);
  };

  // Handle animation timing
  useEffect(() => {
    if (!isPlaying) return;

    const advanceLine = () => {
      setCurrentLineIndex(prev => {
        const newIndex = prev + 1;
        if (newIndex >= lines.length) {
          setIsPlaying(false);
          return prev;
        }
        
        // If we've moved past HIGHLIGHT_POSITION lines, scroll up
        if (newIndex > HIGHLIGHT_POSITION) {
          updateVisibleLines(newIndex - HIGHLIGHT_POSITION);
        }
        
        return newIndex;
      });
    };

    timerRef.current = setInterval(advanceLine, lineInterval);
    return () => clearInterval(timerRef.current);
  }, [isPlaying, lines.length, lineInterval]);

  const renderLine = (line, index) => {
    const isHighlighted = index === HIGHLIGHT_POSITION && 
                         currentLineIndex === visibleLines[index]?.index;
    
    return (
      <div 
        key={line.index}
        style={{ transition: `all ${scrollDuration}ms` }}
        className={`h-12 flex items-center 
          ${isHighlighted ? 'bg-blue-100 rounded-lg px-4' : 'px-4'}`}
      >
        <span 
          className={`text-xl transition-colors duration-300 
            ${isHighlighted ? 'text-blue-600 font-bold' : 'text-gray-600'}`}
        >
          {line.text}
        </span>
      </div>
    );
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setCurrentLineIndex(0);
    updateVisibleLines(0);
    setIsPlaying(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-teal-100 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">
              Karaoke Display
            </h2>
            <div className="flex gap-2">
              <button
                onClick={togglePlayPause}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={handleRestart}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Restart
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="bg-gray-50 p-6 rounded-lg border mb-4">
              <div className="space-y-4 relative overflow-hidden">
                {visibleLines.map((line, idx) => renderLine(line, idx))}
              </div>
            </div>
            
            <div className="flex justify-center mt-4">
              <button
                onClick={onBack}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Back to Results
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}