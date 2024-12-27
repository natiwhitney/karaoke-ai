import React, { useRef, useState, useEffect } from 'react';

const AudioPlayer = ({ vocalsPath, instrumentalPath }) => {
  const vocalsRef = useRef(null);
  const instrumentalRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [vocalsVolume, setVocalsVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    // Reset state when paths change
    setIsPlaying(false);
    setCurrentTime(0);
    
    // Set instrumental track to full volume
    if (instrumentalRef.current) {
      instrumentalRef.current.volume = 1;
    }
    
    // Initialize vocals volume
    if (vocalsRef.current) {
      vocalsRef.current.volume = vocalsVolume;
    }
  }, [vocalsPath, instrumentalPath]);

  const handlePlayPause = () => {
    if (isPlaying) {
      vocalsRef.current?.pause();
      instrumentalRef.current?.pause();
    } else {
      // Always ensure instrumental is at full volume
      if (instrumentalRef.current) {
        instrumentalRef.current.volume = 1;
      }
      vocalsRef.current?.play();
      instrumentalRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVocalsVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVocalsVolume(newVolume);
    if (vocalsRef.current) {
      vocalsRef.current.volume = newVolume;
    }
  };

  const handleTimeUpdate = () => {
    if (vocalsRef.current) {
      setCurrentTime(vocalsRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (vocalsRef.current) {
      setDuration(vocalsRef.current.duration);
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Hidden audio elements */}
      <audio
        ref={vocalsRef}
        src={`http://localhost:8000${vocalsPath}`}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      <audio
        ref={instrumentalRef}
        src={`http://localhost:8000${instrumentalPath}`}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Play/Pause Button */}
      <div className="flex items-center justify-between bg-gray-100 p-4 rounded-lg">
        <button 
          onClick={handlePlayPause}
          className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full w-12 h-12 flex items-center justify-center transition-colors"
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
          )}
        </button>
        
        <div className="flex-1 mx-4 text-center">
          <div className="text-sm text-gray-600">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>

      {/* Vocals Volume Control */}
      <div className="space-y-2">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700 w-20">Vocals:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={vocalsVolume}
            onChange={handleVocalsVolumeChange}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-gray-600 w-16 text-right">
            {Math.round(vocalsVolume * 100)}%
          </span>
        </div>

        {/* Track Information */}
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div>Instrumental: Always 100%</div>
          <div>Vocals: {Math.round(vocalsVolume * 100)}%</div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;