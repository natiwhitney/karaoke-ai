import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, Search, Music } from "lucide-react";
import AudioPlayer from './AudioPlayer';
import { API_BASE_URL } from '@/config/api';


const SongProcessor = () => {
  // Form and state management
  const [formData, setFormData] = useState({
    artist: '',
    songTitle: '',
  });

  const [state, setState] = useState({
    lyrics: null,
    videoResults: [],
    selectedVideo: null,
    isProcessing: false,
    audioData: null,
    error: null,
    isSearching: false
  });

  // WebSocket state
  const [wsStatus, setWsStatus] = useState('');
  const [websocket, setWebsocket] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const setupWebSocket = (sessionId) => {
    const ws = new WebSocket(`${API_BASE_URL.replace('http', 'ws')}/ws/${sessionId}`);
    
    ws.onopen = () => {
      console.log('WebSocket Connected');
      setWebsocket(ws);
    };

    ws.onmessage = (event) => {
      try {
        const status = JSON.parse(event.data);
        console.log('WebSocket message received:', status);
        setWsStatus(status.message || status.stage);
        
        switch (status.stage) {
          case 'downloading':
            setState(prev => ({
              ...prev,
              isProcessing: true,
              processingStage: 'downloading',
              processingProgress: status.progress
            }));
            break;
            
          case 'processing':
            setState(prev => ({
              ...prev,
              isProcessing: true,
              processingStage: 'separating tracks',
              processingProgress: status.progress
            }));
            break;
            
          case 'complete':
            setState(prev => ({
              ...prev,
              isProcessing: false,
              audioData: {
                vocalsPath: status.data.vocals_path || status.data.vocalsPath,
                instrumentalPath: status.data.instrumental_path || status.data.instrumentalPath
              }
            }));
            ws.close();
            break;
            
          case 'error':
            setState(prev => ({ ...prev, isProcessing: false, error: status.message }));
            ws.close();
            break;
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
        setState(prev => ({
          ...prev, 
          isProcessing: false,
          error: 'Error processing server response'
        }));
        ws.close();
      }
    };
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: 'Connection error. Please try again.'
      }));
    };

    ws.onclose = () => {
      console.log('WebSocket Disconnected');
      setWebsocket(null);
    };

    return ws;
  };

  const handleSearch = async () => {
    if (!formData.artist || !formData.songTitle) {
      setState(prev => ({
        ...prev,
        error: 'Please enter both artist and song title'
      }));
      return;
    }

    setState(prev => ({ ...prev, isSearching: true, error: null }));

    try {
      // Parallel requests for lyrics and video search
      const [lyricsResponse, videoResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/fetch-lyrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artist: formData.artist,
            song_title: formData.songTitle
          })
        }),
        fetch(`${API_BASE_URL}/api/search-videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artist: formData.artist,
            song_title: formData.songTitle
          })
        })
      ]);

      if (!lyricsResponse.ok || !videoResponse.ok) {
        throw new Error('Server error. Please try again.');
      }

      const [lyricsData, videoData] = await Promise.all([
        lyricsResponse.json(),
        videoResponse.json()
      ]);

      setState(prev => ({
        ...prev,
        lyrics: lyricsData.lyrics,
        videoResults: videoData.results || [],
        isSearching: false,
        error: lyricsData.error || videoData.error || null
      }));
    } catch (error) {
      console.error('Search error:', error);
      setState(prev => ({
        ...prev,
        isSearching: false,
        error: 'Failed to fetch results. Please try again.'
      }));
    }
  };

  const handleVideoSelect = async (video) => {
    setState(prev => ({
      ...prev,
      selectedVideo: video,
      isProcessing: true,
      error: null
    }));

    const sessionId = crypto.randomUUID();
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/split-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtube_url: video.url,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process video');
      }

      const data = await response.json();
      
      if (data.error) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          error: data.error
        }));
        return;
      }

      // Check if we got a cached response (immediate result)
      if (response.headers.get('x-cached') === 'true') {
        console.log('Using cached audio files');
        setState(prev => ({
          ...prev,
          isProcessing: false,
          audioData: {
            vocalsPath: data.vocalsPath,
            instrumentalPath: data.instrumentalPath
          }
        }));
      } else {
        // If not cached, set up WebSocket for progress updates
        console.log('Setting up WebSocket for processing updates');
        setupWebSocket(sessionId);
      }
    } catch (error) {
      console.error('Processing error:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: 'Failed to process video. Please try again.'
      }));
    }
  };

  // Format duration from seconds to mm:ss
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle>Search Song</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              name="artist"
              placeholder="Artist name"
              value={formData.artist}
              onChange={handleInputChange}
              required
            />
            <Input
              name="songTitle"
              placeholder="Song title"
              value={formData.songTitle}
              onChange={handleInputChange}
              required
            />
          </div>
          <Button 
            className="mt-4 w-full"
            onClick={handleSearch}
            disabled={state.isSearching}
          >
            {state.isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {state.error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lyrics Panel */}
        {state.lyrics && (
          <Card>
            <CardHeader>
              <CardTitle>Lyrics</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm">
                {state.lyrics}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Video Results */}
        {state.videoResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Available Videos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {state.videoResults.map((video) => (
                  <div 
                    key={video.url}
                    className={`border rounded-lg p-4 ${
                      state.selectedVideo?.url === video.url 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Thumbnail */}
                      <div className="relative w-32 h-24 flex-shrink-0">
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-full object-cover rounded-md"
                        />
                        <div className="absolute bottom-1 right-1 bg-black/75 text-white text-xs px-1 rounded">
                          {formatDuration(video.duration)}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-grow">
                        <h3 className="font-medium text-sm">{video.title}</h3>
                        <p className="text-sm text-gray-500">{video.channel}</p>
                      </div>

                      {/* Action Button */}
                      <Button
                        variant={state.selectedVideo?.url === video.url ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => handleVideoSelect(video)}
                        disabled={state.isProcessing}
                      >
                        {state.selectedVideo?.url === video.url ? (
                          state.isProcessing ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Music className="mr-2 h-4 w-4" />
                              Selected
                            </>
                          )
                        ) : (
                          'Select'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Processing Status */}
      {wsStatus && state.isProcessing && (
        <Alert>
          <AlertTitle>Processing Status</AlertTitle>
          <div className="space-y-2">
            <AlertDescription className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {wsStatus}
            </AlertDescription>
            {state.processingProgress !== undefined && (
              <div className="w-full">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, state.processingProgress)}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {Math.round(state.processingProgress)}% Complete
                </p>
              </div>
            )}
          </div>
        </Alert>
      )}

      {/* Audio Player */}
      {state.audioData && (
        <Card>
          <CardHeader>
            <CardTitle>Audio Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <AudioPlayer
              vocalsPath={state.audioData.vocalsPath}
              instrumentalPath={state.audioData.instrumentalPath}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SongProcessor;