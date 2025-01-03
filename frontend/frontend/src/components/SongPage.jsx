import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Music, Split } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import LyricsModal from './LyricsModal';
import AudioPlayer from './AudioPlayer';

const API_BASE_URL = 'http://127.0.0.1:8000';


const SongPage = ({ artistName, songName, onBack }) => {
  const [state, setState] = useState({
    lyrics: null,
    error: null,
    loading: false,
    fromCache: false,
    videoResults: [],
    selectedVideo: null,
    downloadProgress: 0,
    mp3Path: null,
    isSearching: false,
    isDownloading: false,
    isSplitting: false,
    isTransforming: false,
    splitResults: {
      vocalsPath: null,
      instrumentalPath: null
    }
  });

  const [transformInput, setTransformInput] = useState("");
  const [lyricsVersions, setLyricsVersions] = useState([]);
  const [activeTab, setActiveTab] = useState('original');
  const [showLyricsModal, setShowLyricsModal] = useState(false);

  const fetchLyrics = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/fetch-lyrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist: artistName, song_title: songName }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch lyrics');
      }

      const data = await response.json();
      setState(prev => ({
        ...prev,
        lyrics: data.lyrics,
        fromCache: response.headers.get('x-cached') === 'true',
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        loading: false
      }));
    }
  };

  useEffect(() => {
    fetchLyrics();
    fetchSongInfo();
  }, [artistName, songName]);

  const handleSearchVideos = async () => {
    setState(prev => ({ ...prev, isSearching: true, error: null }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/search-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: artistName,
          song_title: songName
        })
      });
      const data = await response.json();
      setState(prev => ({
        ...prev,
        videoResults: data.results || [],
        isSearching: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isSearching: false
      }));
    }
  };
  const fetchSongInfo = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/library`);
        const data = await response.json();
        const artist = data.library.find(a => a.name === artistName);
        const song = artist?.children?.find(s => s.name === songName);
        
        console.log("Found song files:", song?.files); // Add this log
        
        if (song?.files) {
            setState(prev => ({
                ...prev,
                mp3Path: song.files.mp3Path,
                splitResults: {
                    vocalsPath: song.files.vocalsPath,
                    instrumentalPath: song.files.instrumentalPath
                },
                isCheckingFiles: false
            }));
            
            // Add this log to verify the final path
            console.log("Full audio URL:", `${API_BASE_URL}${song.files.mp3Path}`);
        } else {
            setState(prev => ({ ...prev, isCheckingFiles: false }));
        }
    } catch (error) {
        console.error('Error checking files:', error);
        setState(prev => ({ ...prev, isCheckingFiles: false }));
    }
};

 const fetchLyricsVersions = async () => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/lyrics/versions/${encodeURIComponent(artistName)}/${encodeURIComponent(songName)}`
    );
    const data = await response.json();
    
    // Ensure we're setting an array
    if (data && Array.isArray(data.versions)) {
      setLyricsVersions(data.versions);
    } else {
      setLyricsVersions([]);
      console.warn('No versions array in response:', data);
    }
  } catch (error) {
    console.error('Error fetching versions:', error);
    setLyricsVersions([]);  // Set empty array on error
  }
};

// Update useEffect to handle loading state
useEffect(() => {
  const loadData = async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      await Promise.all([
        fetchLyrics(),
        fetchLyricsVersions()
      ]);
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };
  
  loadData();
}, [artistName, songName]);

const handleTransform = async () => {
  if (!state.lyrics || !transformInput.trim()) return;
  
  setState(prev => ({ ...prev, isTransforming: true, error: null }));
  
  try {
    const session_id = crypto.randomUUID();
    const ws = new WebSocket(`ws://localhost:8000/ws/${session_id}`);
    
    ws.onmessage = async (event) => {
      const status = JSON.parse(event.data);
      
      if (status.stage === "complete") {
        // Fetch updated versions after transform
        await fetchLyricsVersions();
        setActiveTab(status.data.version_id);
        setState(prev => ({ ...prev, isTransforming: false }));
        ws.close();
      } else if (status.stage === "error") {
        throw new Error(status.message);
      }
    };

    await new Promise((resolve) => {
      ws.onopen = () => resolve();
    });

    const response = await fetch(`${API_BASE_URL}/api/remix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lyrics: state.lyrics,
        transform_style: transformInput,
        artist_name: artistName,
        song_title: songName,
        session_id: session_id
      })
    });

    if (!response.ok) {
      throw new Error('Failed to initiate transformation');
    }
  } catch (error) {
    setState(prev => ({
      ...prev,
      error: error.message,
      isTransforming: false
    }));
  }
};

  const handleDownload = async (video) => {
  setState(prev => ({ 
      ...prev, 
      selectedVideo: video,
      isDownloading: true,
      error: null,
      splitResults: { vocalsPath: null, instrumentalPath: null }
  }));

  try {
      const response = await fetch(`${API_BASE_URL}/api/download-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              youtube_url: video.url,
              artist: artistName,
              song_title: songName
          })
      });

      const data = await response.json();
      if (response.ok) {
          setState(prev => ({
              ...prev,
              mp3Path: data.mp3Path,
              isDownloading: false
          }));
          // Refresh song info after download
          await fetchSongInfo();
      } else {
          throw new Error(data.error || 'Failed to download audio');
      }
  } catch (error) {
      setState(prev => ({
          ...prev,
          error: error.message,
          isDownloading: false
      }));
  }
};

// Add the split handler inside SongPage component
const handleSplit = async () => {
  setState(prev => ({
    ...prev,
    isSplitting: true,
    error: null
  }));

  try {
    const response = await fetch(`${API_BASE_URL}/api/split-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artist: artistName,
        song_title: songName,
        youtube_url: state.selectedVideo?.url
      })
    });

    const data = await response.json();
    if (response.ok) {
      setState(prev => ({
        ...prev,
        isSplitting: false,
        splitResults: {
          vocalsPath: data.vocalsPath,
          instrumentalPath: data.instrumentalPath
        }
      }));
    } else {
      throw new Error(data.error || 'Failed to split audio');
    }
  } catch (error) {
    setState(prev => ({
      ...prev,
      error: error.message,
      isSplitting: false
    }));
  }
};
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
    return (
      <div className="space-y-6">
        <div className="flex items-center mb-4">
          <Button onClick={onBack} variant="outline" className="mr-4">
            Back
          </Button>
          <h1 className="text-2xl font-bold">{`${artistName} - ${songName}`}</h1>
        </div>
  
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lyrics Panel */}
          <Card>
            <CardHeader className="flex flex-col space-y-4">
              <div className="flex justify-between items-center">
                <CardTitle>Lyrics</CardTitle>
                {state.lyrics && (
                  <Button variant="outline" size="sm" onClick={() => setShowLyricsModal(true)}>
                    Expand
                  </Button>
                )}
              </div>
  
              {/* Transform Input */}
              {state.lyrics && (
                <div className="flex gap-2 items-center mt-4">
                  <input
                    type="text"
                    value={transformInput}
                    onChange={(e) => setTransformInput(e.target.value)}
                    placeholder="Enter transform style..."
                    className="flex-1 px-3 py-2 border rounded-md"
                  />
                  <Button
                    onClick={handleTransform}
                    disabled={!transformInput.trim() || state.isTransforming}
                  >
                    {state.isTransforming ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        <span>Transforming...</span>
                      </div>
                    ) : (
                      'Transform'
                    )}
                  </Button>
                </div>
              )}
  
              {/* Lyrics Tabs */}
              {state.lyrics && (
                <div className="flex gap-2 border-b">
                  <button
                    onClick={() => setActiveTab('original')}
                    className={`px-3 py-1 text-sm font-medium rounded-t-lg ${
                      activeTab === 'original'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Original
                  </button>
                  {Array.isArray(lyricsVersions) && lyricsVersions.map((version, index) => (
                    <button
                      key={version.id || index}
                      onClick={() => setActiveTab(version.id || index.toString())}
                      className={`px-3 py-1 text-sm font-medium rounded-t-lg ${
                        activeTab === (version.id || index.toString())
                          ? 'border-b-2 border-blue-500 text-blue-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Version {new Date(version.timestamp).toLocaleDateString()}
                    </button>
                  ))}
                </div>
              )}
            </CardHeader>
  
            <CardContent>
              {state.loading ? (
                <div className="text-center py-4">Loading lyrics...</div>
              ) : state.lyrics ? (
                <div className="space-y-2">
                  {activeTab !== 'original' && (
                    <div className="text-sm text-gray-500">
                      Style: {lyricsVersions.find(v => v.id === activeTab)?.style || ''}
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg max-h-[400px] overflow-y-auto">
                    {activeTab === 'original' 
                      ? state.lyrics 
                      : lyricsVersions.find(v => v.id === activeTab)?.lyrics || ''
                    }
                  </pre>
                </div>
              ) : (
                <div className="text-center py-4">No lyrics available</div>
              )}
            </CardContent>
          </Card>
  
          {/* Audio Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Audio</CardTitle>
            </CardHeader>
            <CardContent>
              {state.isCheckingFiles ? (
                <div className="text-center py-4">Checking for existing files...</div>
              ) : state.splitResults.vocalsPath && state.splitResults.instrumentalPath ? (
                <AudioPlayer
                  vocalsPath={state.splitResults.vocalsPath}
                  instrumentalPath={state.splitResults.instrumentalPath}
                />
              ) : state.mp3Path ? (
                <div className="space-y-4">
                  <audio controls className="w-full">
                    <source src={`${API_BASE_URL}${state.mp3Path}`} type="audio/mpeg" />
                  </audio>
                  <Button
                    onClick={handleSplit}
                    disabled={state.isSplitting}
                    className="w-full"
                  >
                    {state.isSplitting ? (
                      <>
                        <Split className="mr-2 h-4 w-4 animate-spin" />
                        Splitting Audio...
                      </>
                    ) : (
                      <>
                        <Split className="mr-2 h-4 w-4" />
                        Split Audio Tracks
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button onClick={handleSearchVideos} disabled={state.isSearching}>
                  <Search className="mr-2 h-4 w-4" />
                  {state.isSearching ? "Searching..." : "Find Audio"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
  
        {/* Video Results */}
        {state.videoResults.length > 0 && !state.mp3Path && (
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
                      <div className="flex-grow">
                        <h3 className="font-medium text-sm">{video.title}</h3>
                        <p className="text-sm text-gray-500">{video.channel}</p>
                      </div>
                      <Button
                        variant={state.selectedVideo?.url === video.url ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => handleDownload(video)}
                        disabled={state.isDownloading}
                      >
                        {state.selectedVideo?.url === video.url ? 
                          (state.isDownloading ? "Downloading..." : "Downloaded") : 
                          "Download"
                        }
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
  
        {/* Error Alert */}
        {state.error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
  
        {/* Lyrics Modal */}
        {/* Lyrics Modal */}
<LyricsModal 
  isOpen={showLyricsModal} 
  onClose={() => setShowLyricsModal(false)}
>
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold">{`${artistName} - ${songName}`}</h2>
      
      {/* Version tabs in modal */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('original')}
          className={`px-3 py-1 text-sm font-medium rounded-lg ${
            activeTab === 'original'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          Original
        </button>
        {Array.isArray(lyricsVersions) && lyricsVersions.map((version, index) => (
          <button
            key={version.id || index}
            onClick={() => setActiveTab(version.id || index.toString())}
            className={`px-3 py-1 text-sm font-medium rounded-lg ${
              activeTab === (version.id || index.toString())
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Version {new Date(version.timestamp).toLocaleDateString()}
          </button>
        ))}
      </div>
    </div>

    {/* Version style if viewing a transformed version */}
    {activeTab !== 'original' && (
      <div className="text-sm text-gray-500">
        Style: {lyricsVersions.find(v => v.id === activeTab)?.style || ''}
      </div>
    )}

    {/* Lyrics content */}
    <pre className="whitespace-pre-wrap text-lg leading-relaxed max-h-[60vh] overflow-y-auto">
      {activeTab === 'original' 
        ? state.lyrics 
        : lyricsVersions.find(v => v.id === activeTab)?.lyrics || ''
      }
    </pre>
  </div>
</LyricsModal>
      </div>
    );
  };
  
  export default SongPage;