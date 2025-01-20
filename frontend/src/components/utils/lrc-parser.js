// utils/lrc-parser.js
export class LRCParser {
  constructor() {
    this.lyrics = [];
    this.metadata = {};
  }

  // Parse LRC content into structured data
  parse(lrcContent) {
    const lines = lrcContent.split('\n');
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/g;
    
    lines.forEach(line => {
      if (!line.trim()) return;

      // Handle metadata (tags starting with [ar:], [ti:], etc.)
      if (line.startsWith('[') && !line.match(timeRegex)) {
        const metaMatch = line.match(/\[(.+):(.+)\]/);
        if (metaMatch) {
          this.metadata[metaMatch[1]] = metaMatch[2];
        }
        return;
      }

      // Handle timed lyrics
      const timestamps = [];
      let text = line;
      let match;

      // Extract all timestamps from the line
      while ((match = timeRegex.exec(line)) !== null) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const hundredths = parseInt(match[3]);
        const timeInMs = (minutes * 60 * 1000) + (seconds * 1000) + (hundredths * 10);
        timestamps.push(timeInMs);
        text = text.replace(match[0], '');
      }

      // Add lyrics entry if we found timestamps
      if (timestamps.length > 0) {
        this.lyrics.push({
          text: text.trim(),
          startTime: timestamps[0],
          endTime: timestamps[1] || null  // For enhanced LRC with end times
        });
      }
    });

    // Sort lyrics by time
    this.lyrics.sort((a, b) => a.startTime - b.startTime);

    // Calculate end times if not provided
    this.lyrics.forEach((lyric, index) => {
      if (!lyric.endTime && index < this.lyrics.length - 1) {
        lyric.endTime = this.lyrics[index + 1].startTime;
      }
    });

    // Set end time for last line if not provided
    if (this.lyrics.length > 0) {
      const lastLine = this.lyrics[this.lyrics.length - 1];
      if (!lastLine.endTime) {
        lastLine.endTime = lastLine.startTime + 3000; // Default 3 second duration for last line
      }
    }

    return this;
  }

  // Get the line that should be displayed at the current time
  getCurrentLine(timeMs) {
    return this.lyrics.find((lyric, index) => {
      const nextLyric = this.lyrics[index + 1];
      return timeMs >= lyric.startTime && 
             (!nextLyric || timeMs < nextLyric.startTime);
    });
  }

  // Get the progress (0-100) within the current line
  getLineProgress(timeMs) {
    const currentLine = this.getCurrentLine(timeMs);
    if (!currentLine || !currentLine.endTime) return 0;

    const duration = currentLine.endTime - currentLine.startTime;
    const elapsed = timeMs - currentLine.startTime;
    return Math.min(Math.max((elapsed / duration) * 100, 0), 100);
  }

  // Get upcoming lines for display
  getUpcomingLines(timeMs, count = 7) {
    const currentIndex = this.lyrics.findIndex(lyric => 
      timeMs < lyric.endTime || lyric === this.lyrics[this.lyrics.length - 1]
    );
    
    if (currentIndex === -1) return [];

    return this.lyrics.slice(currentIndex, currentIndex + count);
  }
}