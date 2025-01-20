import React, { useState } from 'react';
import AudioRemixApp from './components/AudioRemixApp';
import AudioSplitApp from './components/AudioSplitApp';
import KaraokeCreator from './components/KaraokeCreator';
import KaraokeDisplay from './components/KaraokeDisplay';
import SongProcessor from './components/SongProcessor';
import LibraryDisplay from './components/LibraryDisplay';
import ArtistPage from './components/ArtistPage';
import SongPage from './components/SongPage';
import { testLyrics } from './data/test-lyrics';
import { Music2, Mic, Wand2, Split, PlayCircle, Folder } from 'lucide-react';

function App() {
  const [activeTool, setActiveTool] = useState('karaoke');
  const [showTest, setShowTest] = useState(false);
  const [testMode, setTestMode] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);

  const navigationItems = [
    {
      id: 'process',
      label: 'Song Processor',
      icon: Music2,
      component: SongProcessor,
      isNew: true
    },
    {
      id: 'karaoke',
      label: 'Karaoke Creator',
      icon: Mic,
      component: KaraokeCreator
    },
    {
      id: 'remix',
      label: 'Audio Remix',
      icon: Wand2,
      component: AudioRemixApp
    },
    {
      id: 'split',
      label: 'Audio Split',
      icon: Split,
      component: AudioSplitApp
    },
    {
      id: 'library',
      label: 'Library',
      icon: Folder,
      component: LibraryDisplay,
    },
  ];

  if (showTest) {
    if (testMode === 'timed') {
      return (
        <KaraokeDisplay 
          lyrics={testLyrics}
          metadata={testLyrics.metadata}
          onBack={() => {
            setShowTest(false);
            setTestMode('');
          }}
        />
      );
    }

    if (testMode === 'simple') {
      const simpleLyrics = [
        "This is test line 1",
        "This is test line 2",
        "This is test line 3",
        "This is test line 4",
        "This is test line 5",
        "This is test line 6",
        "This is test line 7",
        "This is test line 8",
        "This is test line 9",
        "This is test line 10"
      ].map((line, index) => ({
        text: line,
        startTime: index * 3000,
        endTime: (index + 1) * 3000
      }));

      return (
        <KaraokeDisplay 
          lyrics={{ lyrics: simpleLyrics }}
          metadata={{ title: "Simple Test", artist: "Test Artist" }}
          onBack={() => {
            setShowTest(false);
            setTestMode('');
          }}
        />
      );
    }
  }

  const renderContent = () => {
    if (selectedSong) {
      return <SongPage 
        artistName={selectedArtist} 
        songName={selectedSong}
        onBack={() => setSelectedSong(null)}
      />;
    }
    if (selectedArtist) {
      return <ArtistPage 
        artistName={selectedArtist}
        onSongSelect={setSelectedSong}
        onBack={() => setSelectedArtist(null)}
      />;
    }
    return navigationItems.map(item => 
      activeTool === item.id && 
      <item.component 
        key={item.id}
        onArtistSelect={setSelectedArtist}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <nav className="bg-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-center space-x-4 py-4">
            {navigationItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTool(item.id);
                  setSelectedArtist(null);
                  setSelectedSong(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 relative ${
                  activeTool === item.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {item.isNew && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1 rounded-full">
                    New
                  </span>
                )}
              </button>
            ))}

            <div 
              className="relative"
              onMouseEnter={() => setShowDropdown(true)}
              onMouseLeave={() => setShowDropdown(false)}
            >
              <button className="px-4 py-2 rounded-lg font-medium bg-green-100 hover:bg-green-200 text-green-700 flex items-center gap-2">
                <PlayCircle className="w-4 h-4" />
                Try Karaoke Test
              </button>
              
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-50">
                  <button
                    onClick={() => {
                      setShowTest(true);
                      setTestMode('simple');
                      setShowDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 rounded-t-lg"
                  >
                    Simple Mode (3s/line)
                  </button>
                  <button
                    onClick={() => {
                      setShowTest(true);
                      setTestMode('timed');
                      setShowDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 rounded-b-lg"
                  >
                    Timed Mode (American Idiot)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="p-6">
        {renderContent()}
      </div>
    </div>
  );
}

export default App;