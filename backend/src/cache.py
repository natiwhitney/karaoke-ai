from pathlib import Path
import hashlib
import json
from datetime import datetime
from typing import Optional, Tuple
import shutil
import os

# Base cache directory
CACHE_DIR = Path("temp/cache")

# Audio caching functions
def get_url_hash(url: str) -> str:
    """Generate a consistent hash for a YouTube URL"""
    cleaned_url = url.split('&')[0]  # Remove parameters after &
    return hashlib.md5(cleaned_url.encode()).hexdigest()

def check_cached_audio(url_hash: str) -> tuple[bool, Optional[str], Optional[str]]:
    """Check if audio has already been processed for this URL"""
    cache_dir = CACHE_DIR / url_hash
    vocals_path = cache_dir / "vocals.wav"
    instrumental_path = cache_dir / "instrumental.wav"
    
    if vocals_path.exists() and instrumental_path.exists():
        return True, f"/audio/cache/{url_hash}/vocals.wav", f"/audio/cache/{url_hash}/instrumental.wav"
    return False, None, None

def save_to_cache(url_hash: str, youtube_url: str, vocals_path: Path, instrumental_path: Path):
    """Save processed files to cache"""
    cache_dir = CACHE_DIR / url_hash
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy files to cache
    shutil.copy2(vocals_path, cache_dir / "vocals.wav")
    shutil.copy2(instrumental_path, cache_dir / "instrumental.wav")
    
    # Save metadata
    metadata = {
        "youtube_url": youtube_url,
        "processed_date": str(datetime.now()),
    }
    with open(cache_dir / "metadata.json", "w") as f:
        json.dump(metadata, f)

# Lyrics caching functions
def get_lyrics_cache_key(artist: str, song_title: str) -> str:
    """Generate a consistent hash for artist and song combination"""
    cache_key = f"{artist.lower().strip()}_{song_title.lower().strip()}"
    return hashlib.md5(cache_key.encode()).hexdigest()

def check_cached_lyrics(cache_key: str) -> Tuple[bool, Optional[str]]:
    """Check if lyrics exist in cache for the given key"""
    lyrics_dir = CACHE_DIR / "lyrics"
    lyrics_file = lyrics_dir / f"{cache_key}.json"
    
    if lyrics_file.exists():
        try:
            with open(lyrics_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return True, data.get('lyrics')
        except Exception as e:
            print(f"Error reading cached lyrics: {e}")
    return False, None

def save_lyrics_to_cache(cache_key: str, artist: str, song_title: str, lyrics: str) -> None:
    """Save lyrics to cache with metadata"""
    lyrics_dir = CACHE_DIR / "lyrics"
    lyrics_dir.mkdir(parents=True, exist_ok=True)
    
    lyrics_data = {
        'artist': artist,
        'song_title': song_title,
        'lyrics': lyrics,
        'cached_date': str(datetime.now())
    }
    
    lyrics_file = lyrics_dir / f"{cache_key}.json"
    with open(lyrics_file, 'w', encoding='utf-8') as f:
        json.dump(lyrics_data, f, ensure_ascii=False, indent=2)