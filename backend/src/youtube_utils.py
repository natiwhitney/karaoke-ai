from typing import Optional, List, Dict
import yt_dlp

def search_youtube_videos(artist: str, song_title: str, max_results: int = 5) -> List[Dict]:
    """Search YouTube for videos matching artist and song title."""
    search_query = f"{artist} - {song_title} official audio"
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,  # Don't download, just get metadata
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Search YouTube
            results = ydl.extract_info(
                f"ytsearch{max_results}:{search_query}",
                download=False
            )
            
            if not results or 'entries' not in results:
                return []
            
            # Format results
            formatted_results = []
            for entry in results['entries']:
                if entry:
                    formatted_results.append({
                        'url': f"https://www.youtube.com/watch?v={entry['id']}",
                        'title': entry['title'],
                        'duration': entry.get('duration', 0),
                        'channel': entry.get('channel', ''),
                        'thumbnail': entry.get('thumbnail', '')
                    })
            
            return formatted_results
    except Exception as e:
        print(f"Error searching YouTube: {e}")
        return []

def extract_video_metadata(url: str) -> Optional[Dict]:
    """Extract artist and song title from YouTube video URL."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Try to parse artist and title from video title
            video_title = info.get('title', '')
            artist = info.get('artist', '')
            track = info.get('track', '')
            
            # If no explicit artist/track metadata, try to parse from title
            if not (artist and track):
                # Common separators in video titles
                separators = [' - ', ' – ', ' — ', ' | ', ': ']
                
                for sep in separators:
                    if sep in video_title:
                        parts = video_title.split(sep, 1)
                        artist = parts[0].strip()
                        track = parts[1].strip()
                        # Remove common suffixes from track title
                        for suffix in [' (Official Audio)', ' (Official Video)', ' [Official Audio]', ' [Official Video]']:
                            track = track.replace(suffix, '')
                        break
            
            return {
                'artist': artist,
                'title': track or video_title,  # Fallback to full title if parsing failed
                'video_title': video_title,
                'duration': info.get('duration', 0),
                'thumbnail': info.get('thumbnail', '')
            }
            
    except Exception as e:
        print(f"Error extracting video metadata: {e}")
        return None