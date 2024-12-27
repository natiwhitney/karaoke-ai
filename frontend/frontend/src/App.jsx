import React, { useState } from 'react';
import AudioRemixApp from './components/AudioRemixApp';
import AudioSplitApp from './components/AudioSplitApp';
import KaraokeCreator from './components/KaraokeCreator';

function App() {
  const [activeTool, setActiveTool] = useState('karaoke'); // 'karaoke', 'remix', or 'split'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-center space-x-4 py-4">
            <button
              onClick={() => setActiveTool('karaoke')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTool === 'karaoke' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Karaoke Creator
            </button>
            <button
              onClick={() => setActiveTool('remix')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTool === 'remix' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Audio Remix
            </button>
            <button
              onClick={() => setActiveTool('split')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTool === 'split' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Audio Split
            </button>
          </div>
        </div>
      </nav>

      {/* Content Area */}
      <div className="p-6">
        {activeTool === 'karaoke' && <KaraokeCreator />}
        {activeTool === 'remix' && <AudioRemixApp />}
        {activeTool === 'split' && <AudioSplitApp />}
      </div>
    </div>
  );
}

export default App;