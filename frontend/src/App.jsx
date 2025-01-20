import React, { useState } from 'react';
import AudioRemixApp from './components/AudioRemixApp';
import LibraryDisplay from './components/LibraryDisplay';
import ArtistPage from './components/ArtistPage';
import SongPage from './components/SongPage';
import { testLyrics } from './data/test-lyrics';
import { Wand2, Folder } from 'lucide-react';

function App() {
  const [activeTool, setActiveTool] = useState('remix');
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);

  const navigationItems = [
    {
      id: 'remix',
      label: 'Audio Remix',
      icon: Wand2,
      component: AudioRemixApp
    },
    {
      id: 'library',
      label: 'Library',
      icon: Folder,
      component: LibraryDisplay,
    },
  ];

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
              </button>
            ))}
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
