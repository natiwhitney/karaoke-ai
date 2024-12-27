import React, { useState, useCallback, useEffect } from 'react';
import AudioPlayer from './AudioPlayer';
import LyricsModal from './LyricsModal';

const KaraokeCreator = () => {
  // Form and feature states
  const [formData, setFormData] = useState({
    artistName: '',
    songTitle: '',
    youtubeUrl: '',
    transformStyle: 'A song about US capitalism'
  });

  const [displayMode, setDisplayMode] = useState('original'); // 'original' or 'transformed'
  const [isModalOpen, setIsModalOpen] = useState(false);


  const [lyrics, setLyrics] = useState({
    original: null,
    transformed: null,
    loading: false,
    error: null
  });

  const [audio, setAudio] = useState({
    vocalsPath: null,
    instrumentalPath: null,
    loading: false,
    error: null
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const fetchLyrics = async () => {
    setLyrics(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch('http://localhost:8000/api/fetch-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: formData.artistName,
          song_title: formData.songTitle
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setLyrics(prev => ({
        ...prev,
        original: data.lyrics,
        loading: false
      }));
    } catch (err) {
      setLyrics(prev => ({
        ...prev,
        error: err.message,
        loading: false
      }));
    }
  };
  const transformLyrics = async () => {
    if (!lyrics.original) return;
    
    setLyrics(prev => ({ ...prev, loading: true, error: null }));
    try {
      // Create a session ID
      const session_id = crypto.randomUUID();
      
      // Set up WebSocket connection
      const ws = new WebSocket(`ws://localhost:8000/ws/${session_id}`);
      
      ws.onmessage = (event) => {
        const status = JSON.parse(event.data);
        
        if (status.stage === "complete") {
          setLyrics(prev => ({
            ...prev,
            transformed: status.data.transformed_lyrics,
            loading: false
          }));
          ws.close();
        } else if (status.stage === "error") {
          throw new Error(status.message);
        }
      };
  
      // Wait for WebSocket connection to be established
      await new Promise((resolve) => {
        ws.onopen = () => resolve();
      });
  
      // Send remix request
      const response = await fetch('http://localhost:8000/api/remix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyrics: lyrics.original,
          transform_style: formData.transformStyle,
          session_id: session_id,
          custom_prompt: null
        })
      });
  
      if (!response.ok) {
        throw new Error('Failed to initiate transformation');
      }
      
    } catch (err) {
      setLyrics(prev => ({
        ...prev,
        error: err.message,
        loading: false
      }));
      console.error('Transform error:', err);
    }
  };

  const processAudio = async () => {
    setAudio(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch('http://localhost:8000/api/split-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtube_url: formData.youtubeUrl
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setAudio({
        vocalsPath: data.vocalsPath,
        instrumentalPath: data.instrumentalPath,
        loading: false,
        error: null
      });
    } catch (err) {
      setAudio(prev => ({
        ...prev,
        error: err.message,
        loading: false
      }));
    }
  };

  const LyricsContent = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Lyrics</h3>
        {lyrics.transformed && (
          <div className="flex gap-2">
            <button
              onClick={() => setDisplayMode('original')}
              className={`px-3 py-1 rounded-md text-sm ${
                displayMode === 'original' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200'
              }`}
            >
              Original
            </button>
            <button
              onClick={() => setDisplayMode('transformed')}
              className={`px-3 py-1 rounded-md text-sm ${
                displayMode === 'transformed' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200'
              }`}
            >
              Transformed
            </button>
          </div>
        )}
      </div>
      <pre className="whitespace-pre-wrap text-lg leading-relaxed">
        {displayMode === 'original' ? lyrics.original : lyrics.transformed}
      </pre>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Input Form Section */}
      <div className="bg-white rounded-lg shadow-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Artist Name
            </label>
            <input
              type="text"
              name="artistName"
              value={formData.artistName}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Song Title
            </label>
            <input
              type="text"
              name="songTitle"
              value={formData.songTitle}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              YouTube URL
            </label>
            <input
              type="text"
              name="youtubeUrl"
              value={formData.youtubeUrl}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transform Style
            </label>
            <input
              type="text"
              name="transformStyle"
              value={formData.transformStyle}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border rounded-md"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={fetchLyrics}
            disabled={lyrics.loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-400"
          >
            {lyrics.loading ? 'Loading...' : 'Get Lyrics'}
          </button>
          
          <button
            onClick={transformLyrics}
            disabled={!lyrics.original || lyrics.loading}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg disabled:bg-gray-400"
          >
            {lyrics.loading ? 'Transforming...' : 'Transform'}
          </button>

          <button
            onClick={processAudio}
            disabled={audio.loading}
            className="px-4 py-2 bg-green-500 text-white rounded-lg disabled:bg-gray-400"
          >
            {audio.loading ? 'Processing...' : 'Split Audio'}
          </button>
        </div>
      </div>

     {/* Content Display Section */}
     {(lyrics.original || audio.vocalsPath) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lyrics Panel with Expand Button */}
          {lyrics.original && (
            <div className="bg-white rounded-lg shadow-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Lyrics</h3>
                <div className="flex gap-2 items-center">
                  {lyrics.transformed && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDisplayMode('original')}
                        className={`px-3 py-1 rounded-md text-sm ${
                          displayMode === 'original' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200'
                        }`}
                      >
                        Original
                      </button>
                      <button
                        onClick={() => setDisplayMode('transformed')}
                        className={`px-3 py-1 rounded-md text-sm ${
                          displayMode === 'transformed' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200'
                        }`}
                      >
                        Transformed
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    title="Expand lyrics"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="h-[300px] overflow-y-auto">
                <LyricsContent />
              </div>
            </div>
          )}

          {/* Audio Control Panel */}
          {audio.vocalsPath && audio.instrumentalPath && (
            <div className="bg-white rounded-lg shadow-xl p-6">
              <h3 className="text-xl font-semibold mb-4">Audio Controls</h3>
              <AudioPlayer
                vocalsPath={audio.vocalsPath}
                instrumentalPath={audio.instrumentalPath}
              />
            </div>
          )}
        </div>
      )}

      {/* Lyrics Modal */}
      <LyricsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      >
        <LyricsContent />
      </LyricsModal>

      {/* Error Display */}
      {(lyrics.error || audio.error) && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{lyrics.error || audio.error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KaraokeCreator;