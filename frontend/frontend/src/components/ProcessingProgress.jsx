import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, Music2, Loader2, Check } from "lucide-react";

const ProcessingStages = {
  DOWNLOADING: 'downloading',
  CONVERTING: 'converting',
  PROCESSING: 'processing',
  COMPLETE: 'complete'
};

const ProcessingProgress = ({ stage, progress, message }) => {
  const getStageIcon = (currentStage) => {
    switch (currentStage) {
      case ProcessingStages.DOWNLOADING:
        return <Download className="w-5 h-5" />;
      case ProcessingStages.CONVERTING:
      case ProcessingStages.PROCESSING:
        return <Music2 className="w-5 h-5" />;
      case ProcessingStages.COMPLETE:
        return <Check className="w-5 h-5" />;
      default:
        return <Loader2 className="w-5 h-5 animate-spin" />;
    }
  };

  const getStageTitle = (currentStage) => {
    switch (currentStage) {
      case ProcessingStages.DOWNLOADING:
        return "Downloading Audio";
      case ProcessingStages.CONVERTING:
        return "Converting Format";
      case ProcessingStages.PROCESSING:
        return "Processing Audio";
      case ProcessingStages.COMPLETE:
        return "Processing Complete";
      default:
        return "Processing";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          {getStageIcon(stage)}
          {getStageTitle(stage)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Progress value={progress} className="h-2" />
          <div className="text-sm text-gray-500">
            {message || `${Math.round(progress)}% complete`}
          </div>
          
          {/* Stage Indicators */}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {Object.values(ProcessingStages).map((stageKey) => {
              const isActive = stage === stageKey;
              const isComplete = progress === 100 || 
                Object.values(ProcessingStages)
                  .indexOf(stage) > Object.values(ProcessingStages)
                  .indexOf(stageKey);
              
              return (
                <div 
                  key={stageKey}
                  className={`text-xs px-2 py-1 rounded-full text-center ${
                    isActive ? 'bg-blue-500 text-white' :
                    isComplete ? 'bg-green-500 text-white' :
                    'bg-gray-100 text-gray-500'
                  }`}
                >
                  {stageKey.charAt(0).toUpperCase() + stageKey.slice(1)}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProcessingProgress;