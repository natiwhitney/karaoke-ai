import React, { useRef, useState, useEffect } from 'react';

const AudioPlayer = ({ vocalsPath, instrumentalPath }) => {
  const vocalsRef = useRef(null);
  const instrumentalRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [vocalsVolume, setVocalsVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Reset state when paths change
    setIsPlaying(false);
    setCurrentTime(0);
    
    // Set initial volumes
    if (instrumentalRef.current) {
      instrumentalRef.current.volume = 1;
    }
    if (vocalsRef.current) {
      vocalsRef.current.volume = vocalsVolume;
    }
  }, [vocalsPath, instrumentalPath]);

  const handlePlayPause = () => {
    if (isPlaying) {
      vocalsRef.current?.pause();
      instrumentalRef.current?.pause();
    } else {
      // Set both tracks to same time before playing
      const targetTime = vocalsRef.current?.currentTime || 0;
      if (instrumentalRef.current) instrumentalRef.current.currentTime = targetTime;
      if (vocalsRef.current) vocalsRef.current.currentTime = targetTime;
      
      vocalsRef.current?.play();
      instrumentalRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVocalsVolumeChange = (e) => {
    const volume = parseFloat(e.target.value);
    setVocalsVolume(volume);
    if (vocalsRef.current) {
      vocalsRef.current.volume = volume;
    }
  };

  const handleTimeUpdate = () => {
    if (!isDragging && vocalsRef.current) {
      setCurrentTime(vocalsRef.current.currentTime);
      // Keep instrumental track synchronized
      if (Math.abs(instrumentalRef.current?.currentTime - vocalsRef.current.currentTime) > 0.1) {
        instrumentalRef.current.currentTime = vocalsRef.current.currentTime;
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (vocalsRef.current) {
      setDuration(vocalsRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    
    // Update both audio elements
    if (vocalsRef.current) vocalsRef.current.currentTime = time;
    if (instrumentalRef.current) instrumentalRef.current.currentTime = time;
  };

  const handleDragStart = () => {
    setIsDragging(true);
    if (isPlaying) {
      vocalsRef.current?.pause();
      instrumentalRef.current?.pause();
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (isPlaying) {
      vocalsRef.current?.play();
      instrumentalRef.current?.play();
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

      {/* Main controls */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        {/* Play/Pause and Time Display */}
        <div className="flex items-center justify-between mb-2">
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
          <div className="text-sm font-medium text-gray-600">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Time Slider */}
        <div className="py-2">
          <input
            type="range"
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            value={currentTime}
            min={0}
            max={duration || 100}
            step={0.1}
            onChange={handleSeek}
            onMouseDown={handleDragStart}
            onMouseUp={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchEnd={handleDragEnd}
            style={{
              background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(currentTime / duration) * 100}%, #E5E7EB ${(currentTime / duration) * 100}%, #E5E7EB 100%)`
            }}
          />
        </div>

        {/* Volume Controls */}
        <div className="space-y-2">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700 w-20">Vocals:</span>
            <input
              type="range"
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              value={vocalsVolume}
              min={0}
              max={1}
              step={0.01}
              onChange={handleVocalsVolumeChange}
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${vocalsVolume * 100}%, #E5E7EB ${vocalsVolume * 100}%, #E5E7EB 100%)`
              }}
            />
            <span className="text-sm text-gray-600 w-16 text-right">
              {Math.round(vocalsVolume * 100)}%
            </span>
          </div>

          {/* Track Information */}
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div>Instrumental: 100%</div>
            <div>Vocals: {Math.round(vocalsVolume * 100)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;