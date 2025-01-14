import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scrollArea";

const LyricsAnalysis = ({ rhymeAnalysis, structureAnalysis }) => {
  const formatRhymePairs = (pairs) => {
    return pairs.map((pair, index) => (
      <div key={index} className="flex justify-between p-2 border-b">
        <span>{pair.word1} ↔ {pair.word2}</span>
        <span className="text-gray-500">Lines: {pair.line_numbers.join(', ')}</span>
      </div>
    ));
  };

  const formatStructure = (sections) => {
    return sections.map((section, index) => (
      <div key={index} className="mb-4 p-2 border-b">
        <div className="font-medium">{section.type}</div>
        <div className="text-sm text-gray-600">Lines: {section.lines}</div>
        <div className="text-sm text-gray-600">Syllables: {section.syllables_per_line.join(', ')}</div>
        <div className="text-sm text-gray-600">Style: {section.style}</div>
      </div>
    ));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Rhyme Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Rhyming Pairs</h3>
                {rhymeAnalysis?.rhyming_pairs && 
                  formatRhymePairs(rhymeAnalysis.rhyming_pairs)}
              </div>
              <div>
                <h3 className="font-medium mb-2">Rhyme Schemes</h3>
                {rhymeAnalysis?.rhyme_schemes && 
                  Object.entries(rhymeAnalysis.rhyme_schemes).map(([section, scheme]) => (
                    <div key={section} className="flex justify-between p-2">
                      <span>{section}</span>
                      <span className="font-mono">{scheme}</span>
                    </div>
                  ))}
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Structure Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Sections</h3>
                {structureAnalysis?.sections && 
                  formatStructure(structureAnalysis.sections)}
              </div>
              {structureAnalysis?.patterns && (
                <div>
                  <h3 className="font-medium mb-2">Patterns</h3>
                  <div className="space-y-2">
                    {Object.entries(structureAnalysis.patterns).map(([type, patterns]) => (
                      <div key={type} className="p-2">
                        <div className="font-medium capitalize">{type}:</div>
                        <ul className="list-disc pl-4">
                          {patterns.map((pattern, i) => (
                            <li key={i} className="text-sm text-gray-600">{pattern}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default LyricsAnalysis;