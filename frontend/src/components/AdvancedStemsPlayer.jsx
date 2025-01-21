import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Loader2, Music2, Play, Pause, RefreshCw } from 'lucide-react';
import { API_BASE_URL, buildAudioUrl } from '../config/api';

const AdvancedStemsPlayer = ({ mp3Path, artist, songTitle }) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [stems, setStems] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [stemVolumes, setStemVolumes] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const audioRefs = useRef({});
  
  const [config, setConfig] = useState({
    stemConfig: "four_stems",
    model: "htdemucs",
    device: "cpu"
  });

  const stemConfigs = [
    { value: "vocals_only", label: "Vocals Only" },
    { value: "four_stems", label: "Four Stems" },
    { value: "six_stems", label: "Six Stems (Piano + Guitar)" }
  ];

  const models = [
    { value: "htdemucs", label: "HTDemucs (High Quality)" },
    { value: "mdx", label: "MDX-Net (Faster)" }
  ];

  const devices = [
    { value: "cpu", label: "CPU" },
    { value: "mps", label: "Apple Silicon (MPS)" },
    { value: "cuda", label: "NVIDIA GPU (CUDA)" }
  ];

  useEffect(() => {
    const checkExistingStems = async () => {
      if (!artist || !songTitle) {
        setIsLoading(false);
        return;
      }

      try {
        const stemTypes = {
          "four_stems": ["vocals", "drums", "bass", "other"],
          "six_stems": ["vocals", "drums", "bass", "guitar", "piano", "other"],
          "vocals_only": ["vocals", "no_vocals"]
        };

        const expectedStems = stemTypes[config.stemConfig];
        if (!expectedStems) {
          setIsLoading(false);
          return;
        }

        // Check if directory exists and construct paths
        const baseDir = `audio/${artist}/${songTitle}/stems`;
        const stemPaths = {};
        let foundAny = false;

        // Try to verify each stem exists
        for (const stem of expectedStems) {
          const stemPath = `${baseDir}/${stem}.wav`;
          try {
            const response = await fetch(buildAudioUrl(stemPath), { 
              method: 'HEAD',
              timeout: 5000
            });
            
            if (response.ok) {
              stemPaths[stem] = stemPath; // Store full path
              foundAny = true;
            }
          } catch (err) {
            console.log(`Stem ${stem} not found:`, err);
          }
        }

        if (foundAny) {
          setStems(stemPaths);
          const initialVolumes = {};
          Object.keys(stemPaths).forEach(stem => {
            initialVolumes[stem] = 1;
          });
          setStemVolumes(initialVolumes);
        }
      } catch (err) {
        console.log('Error checking stems:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingStems();
  }, [artist, songTitle, config.stemConfig]);

  const processSeparation = async () => {
    if (!mp3Path || !artist || !songTitle) {
      setError("Missing song information");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${API_BASE_URL}/advanced-stems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist,
          song_title: songTitle,
          ...config
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error;
        } catch (e) {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Clean up existing audio
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
      audioRefs.current = {};

      // Update stems with new paths
      const newStems = {};
      Object.entries(data.stems || {}).forEach(([stem, path]) => {
        newStems[stem] = path;
      });
      
      setStems(newStems);
      
      // Reset volumes
      const newVolumes = {};
      Object.keys(newStems).forEach(stem => {
        newVolumes[stem] = 1;
      });
      setStemVolumes(newVolumes);

    } catch (err) {
      console.error('Stem processing error:', err);
      setError(err.message === 'AbortError' ? 
        'Processing timed out - please try again' : 
        err.message || 'Failed to process stems'
      );
    } finally {
      setProcessing(false);
    }
  };

  const togglePlayback = () => {
    if (isPlaying) {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) audio.pause();
      });
    } else {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(e => console.error("Playback error:", e));
        }
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (stem, value) => {
    setStemVolumes(prev => ({ ...prev, [stem]: value[0] }));
    if (audioRefs.current[stem]) {
      audioRefs.current[stem].volume = value[0];
    }
  };

  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, []);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Checking for existing stems...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Advanced Stem Separation</span>
          {Object.keys(stems).length > 0 && (
            <Button
              onClick={togglePlayback}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? 'Pause' : 'Play All'}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Separation Type</label>
            <Select
              value={config.stemConfig}
              onValueChange={(value) => setConfig(prev => ({ ...prev, stemConfig: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stemConfigs.map(config => (
                  <SelectItem key={config.value} value={config.value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Select
              value={config.model}
              onValueChange={(value) => setConfig(prev => ({ ...prev, model: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map(model => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Processing Device</label>
            <Select
              value={config.device}
              onValueChange={(value) => setConfig(prev => ({ ...prev, device: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {devices.map(device => (
                  <SelectItem key={device.value} value={device.value}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={processSeparation}
          disabled={processing || !mp3Path}
          className="w-full"
        >
          {processing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Stems...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              {Object.keys(stems).length > 0 ? 'Reprocess Stems' : 'Process Stems'}
            </>
          )}
        </Button>

        {Object.keys(stems).length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium">Stem Controls</h3>
            {Object.entries(stems).map(([stem, path]) => (
              <div key={stem} className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium capitalize">
                    {stem.replace('_', ' ')}
                  </label>
                  <span className="text-sm text-gray-500">
                    {Math.round(stemVolumes[stem] * 100)}%
                  </span>
                </div>
                <Slider
                  value={[stemVolumes[stem] || 1]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={(value) => handleVolumeChange(stem, value)}
                  className="w-full"
                />
                <audio
                  key={stem}
                  ref={el => audioRefs.current[stem] = el}
                  src={path ? buildAudioUrl(path) : ''}
                  onError={(e) => {
                    console.error(`Error loading stem ${stem}:`, e);
                    setError(`Failed to load ${stem} stem`);
                  }}
                  onEnded={() => setIsPlaying(false)}
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AdvancedStemsPlayer;