import React, { useState } from 'react';
import KaraokeDisplay from './KaraokeDisplay';

// Sample lyrics for testing
const SAMPLE_LYRICS = `Verse 1:
In the morning light, I see
Shadows dancing gracefully
Through the window pane so clear
Bringing memories oh so dear

Chorus:
Time keeps flowing like a stream
Reality or just a dream?
Moments pass us by so fast
Making memories that will last

Verse 2:
Footprints in the morning dew
Tell a story nothing new
But the magic still remains
Like the sunshine after rain

Bridge:
Every moment, every day
Has a story it can say
Listen closely, you will find
Treasures of a special kind

Final Chorus:
Time keeps flowing like a stream
Reality or just a dream?
Moments pass us by so fast
Making memories that will last`;

export default function KaraokeTestHarness() {
  const [showKaraoke, setShowKaraoke] = useState(false);
  const [lyrics, setLyrics] = useState(SAMPLE_LYRICS);
  const [settings, setSettings] = useState({
    lineInterval: 3000,
    scrollDuration: 500,
  });

  const handleSettingChange = (setting, value) => {
    const numValue = parseInt(value) || 0;
    setSettings(prev => ({
      ...prev,
      [setting]: numValue
    }));
  };

  if (showKaraoke) {
    return (
      <div>
        <KaraokeDisplay 
          lyrics={lyrics} 
          onBack={() => setShowKaraoke(false)}
          lineInterval={settings.lineInterval}
          scrollDuration={settings.scrollDuration}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-100 to-green-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800">
              Karaoke Display Test Settings
            </h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Timing Controls */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Line Interval (ms)
                </label>
                <input
                  type="number"
                  min={500}
                  max={5000}
                  step={100}
                  value={settings.lineInterval}
                  onChange={(e) => handleSettingChange('lineInterval', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scroll Animation Duration (ms)
                </label>
                <input
                  type="number"
                  min={100}
                  max={1000}
                  step={50}
                  value={settings.scrollDuration}
                  onChange={(e) => handleSettingChange('scrollDuration', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Lyrics Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Lyrics
              </label>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                className="w-full h-64 p-2 border border-gray-300 rounded-md shadow-sm font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Launch Button */}
            <button 
              onClick={() => setShowKaraoke(true)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Launch Karaoke Display
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}