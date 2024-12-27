import React, { useState, useCallback } from 'react';
import AudioPlayer from './AudioPlayer';

const AudioSplitApp = () => {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [audioData, setAudioData] = useState({
    vocalsPath: null,
    instrumentalPath: null
  });
  const [error, setError] = useState(null);

  const handleInputChange = useCallback((e) => {
    setYoutubeUrl(e.target.value);
    setIsCached(false);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setProcessing(true);
    setError(null);
    setIsCached(false);

    try {
      const response = await fetch("http://localhost:8000/api/split-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtube_url: youtubeUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to process audio");
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setIsCached(response.headers.get("x-cached") === "true");
      setAudioData({
        vocalsPath: data.vocalsPath || null,
        instrumentalPath: data.instrumentalPath || null
      });
    } catch (err) {
      setError(err.message);
      setAudioData({ vocalsPath: null, instrumentalPath: null });
    } finally {
      setProcessing(false);
    }
  }, [youtubeUrl]);

  const { vocalsPath, instrumentalPath } = audioData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Input Card */}
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
          <div className="p-6">
            <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
              Audio Split Tool
            </h1>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  YouTube URL
                </label>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={handleInputChange}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={processing}
                className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors
                  ${processing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-500 hover:bg-blue-600'
                  }`}
              >
                {processing ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Processing...
                  </div>
                ) : (
                  "Split Audio"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Audio Player Card */}
        {(vocalsPath || instrumentalPath) && (
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">
                  Audio Player
                </h2>
                {isCached && (
                  <div className="flex items-center text-sm text-gray-500">
                    <svg className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                      <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    Retrieved from cache
                  </div>
                )}
              </div>
              <AudioPlayer
                vocalsPath={vocalsPath}
                instrumentalPath={instrumentalPath}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioSplitApp;