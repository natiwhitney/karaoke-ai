import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TimedKaraokeDisplay from './TimedKaraokeDisplay';

// Hard-coded LRC content for testing
const testLRC = `[ar:Green Day]
[ti:American Idiot]
[length:02:54]
[00:00.00]Don't wanna be an American idiot
[00:02.80]Don't want a nation under the new media
[00:05.50]And can you hear the sound of hysteria?
[00:08.30]The subliminal mind-fuck America
[00:11.20]Welcome to a new kind of tension
[00:14.00]All across the alien nation
[00:16.80]Where everything isn't meant to be okay
[00:22.40]Television dreams of tomorrow
[00:25.20]We're not the ones who're meant to follow
[00:28.00]For that's enough to argue`;

export default function KaraokeTest({ onBack }) {
  const [showDisplay, setShowDisplay] = useState(false);

  if (showDisplay) {
    return (
      <TimedKaraokeDisplay 
        lrcContent={testLRC}
        audioSrc="/audio/American-Idiot.mp3"
        onBack={() => setShowDisplay(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold">Karaoke Test Mode</CardTitle>
            <Button variant="outline" size="sm" onClick={onBack}>
              Back to Main App
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Test Song Details:</h3>
            <p>Artist: Green Day</p>
            <p>Title: American Idiot</p>
            <p>Duration: 2:54</p>
          </div>
          
          <div className="flex justify-center">
            <Button 
              onClick={() => setShowDisplay(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Start Karaoke Test
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}