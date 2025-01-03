from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
from pathlib import Path
from datetime import datetime
import asyncio
import hashlib
import json
import logging
import os
import re
import shutil
import uuid
from dotenv import load_dotenv

# Local imports
from src.cache import (
    get_lyrics_cache_key, 
    check_cached_lyrics,
    save_lyrics_to_cache, 
    get_url_hash,
    check_cached_audio, 
    save_to_cache
)
from src.download import download_song_with_progress
from src.lyrics import fetch_lyrics_from_genius
from src.remix import transform_lyrics
from src.audio import process_audio_with_progress
from src.youtube_utils import search_youtube_videos, extract_video_metadata

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
env_path = Path(__file__).parents[1] / '.env'
load_dotenv(env_path)

logger.info(f"GENIUS_TOKEN: {os.getenv('GENIUS_TOKEN')}")
logger.info(f"USE_OPENAI: {os.getenv('USE_OPENAI')}")

# Directory setup
DOWNLOADS_DIR = Path("downloads")
DOWNLOADS_DIR.mkdir(exist_ok=True)

TEMP_DIR = Path("temp")
TEMP_DIR.mkdir(exist_ok=True)

CACHE_DIR = TEMP_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)

# Audio file constants
AUDIO_FILES = {
    "original": "original.mp3",
    "vocals": "vocals.wav",
    "instrumental": "instrumental.wav"
}

# Initialize FastAPI
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
# Mount static files - mount downloads directory directly at /audio
app.mount("/audio", StaticFiles(directory=str(DOWNLOADS_DIR)), name="downloads")

# WebSocket connections storage
active_connections: dict[str, WebSocket] = {}

# Utility functions
def sanitize_name(name: str) -> str:
    """Sanitize a name for use in filesystem paths."""
    if not name:
        return ""
    sanitized = re.sub(r'[^\w\s-]', '', name)
    sanitized = re.sub(r'\s+', '_', sanitized.strip())
    return sanitized.lower()

def get_song_directory(artist: str, song: str) -> Path:
    """Get the directory path for a song."""
    return DOWNLOADS_DIR / sanitize_name(artist) / sanitize_name(song)

def get_audio_paths(artist: str, song: str) -> dict:
    """Get all audio file paths for a song."""
    song_dir = get_song_directory(artist, song)
    return {
        key: song_dir / filename
        for key, filename in AUDIO_FILES.items()
    }

# Base Models

class DownloadRequest(BaseModel):
    youtube_url: str
    artist: str
    song_title: str

class ProcessingStatus(BaseModel):
    stage: str
    progress: float
    message: str
    data: Optional[dict] = None
"""
# Remix-related Models
class RemixRequest(BaseModel):
    youtube_url: Optional[str] = None
    artist_name: Optional[str] = None
    song_title: Optional[str] = None
    transform_style: str = "A song about US capitalism"
    lyrics: Optional[str] = None
    session_id: str
    custom_prompt: Optional[str] = None"""

class RemixRequest(BaseModel):
    lyrics: Optional[str] = None
    transform_style: str
    artist_name: str
    song_title: str
    session_id: str

class LyricsRequest(BaseModel):
    artist: str
    song_title: str

class LyricsResponse(BaseModel):
    lyrics: str
    error: Optional[str] = None

class SplitRequest(BaseModel):
    artist: str
    song_title: str
    youtube_url: Optional[str] = None

class SplitResponse(BaseModel):
    vocalsPath: str
    instrumentalPath: str
    error: Optional[str] = None

# Add these models to your existing models section
class VideoSearchRequest(BaseModel):
    artist: str
    song_title: str
    max_results: Optional[int] = 5

class VideoMetadata(BaseModel):
    url: str
    title: str
    duration: int
    channel: str
    thumbnail: str

class VideoSearchResponse(BaseModel):
    results: List[VideoMetadata]
    error: Optional[str] = None

    
# Optional: Add metadata extraction endpoint
class MetadataRequest(BaseModel):
    url: str

class VideoMetadataResponse(BaseModel):
    artist: Optional[str]
    title: Optional[str]
    video_title: str
    duration: int
    thumbnail: str
    error: Optional[str] = None

class StatusHandler:
    def __init__(self, session_id: str):
        self.session_id = session_id

    async def send_status(self, stage: str, progress: float, message: str = None, data: dict = None):
        if self.session_id in active_connections:
            await active_connections[self.session_id].send_json({
                "stage": stage,
                "progress": progress,
                "message": message,
                "data": data
            })

    async def update_transform(self, progress: float, message: str = None):
        await self.send_status("transform", progress, message or "Transforming lyrics...")

    async def update_download(self, progress: float, speed: str = None):
        message = f"Downloading at {speed}" if speed else "Downloading..."
        await self.send_status("downloading", progress, message)

    async def update_processing(self, progress: float):
        await self.send_status("processing", progress, "Separating audio tracks...")

    async def send_error(self, error_message: str):
        await self.send_status("error", 0, error_message)

    async def send_complete(self, data: dict):
        await self.send_status("complete", 100, "Process complete", data)

async def transform_and_notify(lyrics: str, style: str, status_handler: StatusHandler, base_dir: Path):
    try:
        await status_handler.update_transform(0, "Starting transformation...")
        transformed_lyrics = transform_lyrics(lyrics, style)
        
        await status_handler.update_transform(50, "Saving transformed lyrics...")
        lyrics_dir = base_dir / "lyrics"
        lyrics_dir.mkdir(exist_ok=True)
        with open(lyrics_dir / "transformed.txt", "w", encoding='utf-8') as f:
            f.write(transformed_lyrics)
        
        await status_handler.send_complete({
            "original_lyrics": lyrics,
            "transformed_lyrics": transformed_lyrics
        })
        
        return transformed_lyrics

    except Exception as e:
        await status_handler.send_error(f"Transform error: {str(e)}")
        raise

async def process_remix(remix_request: RemixRequest, session_id: str):
    base_dir = Path("temp") / session_id
    base_dir.mkdir(parents=True, exist_ok=True)
    status_handler = StatusHandler(session_id)

    try:
        # Get lyrics
        lyrics = remix_request.lyrics
        if not lyrics and remix_request.artist_name and remix_request.song_title:
            await status_handler.send_status("fetch", 0, "Fetching lyrics...")
            lyrics = fetch_lyrics_from_genius(
                remix_request.artist_name,
                remix_request.song_title,
                os.getenv('GENIUS_TOKEN')
            )

        if not lyrics:
            raise HTTPException(status_code=400, detail="No lyrics available")

        # Transform lyrics with new status handler
        prompt_to_use = remix_request.custom_prompt or remix_request.transform_style
        transformed_lyrics = await transform_and_notify(lyrics, prompt_to_use, status_handler, base_dir)

        # Process audio if URL provided
        if remix_request.youtube_url:
            vocals_path, instrumental_path = await process_audio_and_notify(
                remix_request.youtube_url, 
                base_dir, 
                status_handler
            )
            
            await status_handler.send_complete({
                "original_lyrics": lyrics,
                "transformed_lyrics": transformed_lyrics,
                "vocals_path": f"/audio/{session_id}/output/vocals.wav",
                "instrumental_path": f"/audio/{session_id}/output/instrumental.wav"
            })

    except Exception as e:
        await status_handler.send_error(str(e))
        raise HTTPException(status_code=500, detail=str(e))

async def process_audio_and_notify(youtube_url: str, base_dir: Path, status_handler: StatusHandler):
    try:
        await status_handler.update_download(0, "Starting download...")
        
        input_dir = base_dir / "input"
        downloaded_file = await download_song_with_progress(youtube_url, str(input_dir), status_handler)
        
        if not downloaded_file:
            raise HTTPException(status_code=400, detail="Failed to download audio")

        await status_handler.update_processing(0)
        output_dir = base_dir / "output"
        vocals_path, instrumental_path = await process_audio_with_progress(downloaded_file, str(output_dir), status_handler)
        
        if not vocals_path or not instrumental_path:
            raise HTTPException(status_code=400, detail="Failed to process audio")

        return vocals_path, instrumental_path

    except Exception as e:
        await status_handler.send_error(str(e))
        raise

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    active_connections[session_id] = websocket
    try:
        while True:
            await websocket.receive_text()
    except:
        if session_id in active_connections:
            del active_connections[session_id]

def get_url_hash(url: str) -> str:
    """Generate a consistent hash for a YouTube URL"""
    cleaned_url = url.split('&')[0]  # Remove parameters after &
    return hashlib.md5(cleaned_url.encode()).hexdigest()

def check_cached_audio(url_hash: str) -> tuple[bool, Optional[str], Optional[str]]:
    """Check if audio has already been processed for this URL"""
    cache_dir = Path("temp/cache") / url_hash
    vocals_path = cache_dir / "vocals.wav"
    instrumental_path = cache_dir / "instrumental.wav"
    
    if vocals_path.exists() and instrumental_path.exists():
        print(f"Found cached files for hash {url_hash}")
        return True, f"/audio/cache/{url_hash}/vocals.wav", f"/audio/cache/{url_hash}/instrumental.wav"
    return False, None, None

def save_to_cache(url_hash: str, youtube_url: str, vocals_path: Path, instrumental_path: Path):
    """Save processed files to cache"""
    cache_dir = Path("temp/cache") / url_hash
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
    print(f"Saved files to cache: {cache_dir}")


@app.post("/api/search-videos", response_model=VideoSearchResponse)
async def search_videos(request: VideoSearchRequest) -> VideoSearchResponse:
    try:
        # Search for videos using youtube_utils
        results = search_youtube_videos(
            artist=request.artist,
            song_title=request.song_title,
            max_results=request.max_results
        )

        # If no results found, return empty list
        if not results:
            return VideoSearchResponse(results=[])

        # Format results into VideoMetadata objects
        formatted_results = [
            VideoMetadata(
                url=video['url'],
                title=video['title'],
                duration=video.get('duration', 0),
                channel=video.get('channel', 'Unknown'),
                thumbnail=video.get('thumbnail', '')
            )
            for video in results
        ]

        return VideoSearchResponse(results=formatted_results)

    except Exception as e:
        logging.error(f"Error searching videos: {str(e)}")
        return VideoSearchResponse(
            results=[],
            error=f"Failed to search videos: {str(e)}"
        )


@app.post("/api/extract-metadata", response_model=VideoMetadataResponse)
async def get_video_metadata(request: MetadataRequest) -> VideoMetadataResponse:
    try:
        metadata = extract_video_metadata(request.url)
        if not metadata:
            raise ValueError("Could not extract metadata")
            
        return VideoMetadataResponse(
            artist=metadata.get('artist'),
            title=metadata.get('title'),
            video_title=metadata.get('video_title', ''),
            duration=metadata.get('duration', 0),
            thumbnail=metadata.get('thumbnail', ''),
        )
        
    except Exception as e:
        logging.error(f"Error extracting metadata: {str(e)}")
        return VideoMetadataResponse(
            video_title="",
            duration=0,
            thumbnail="",
            error=f"Failed to extract metadata: {str(e)}"
        )

@app.post("/api/remix")
async def create_remix(remix_request: RemixRequest):
    try:
        # Get the song directory
        artist_dir = sanitize_name(remix_request.artist_name)
        song_dir = sanitize_name(remix_request.song_title)
        song_path = DOWNLOADS_DIR / artist_dir / song_dir
        song_path.mkdir(parents=True, exist_ok=True)

        # Create versions directory if it doesn't exist
        versions_dir = song_path / "versions"
        versions_dir.mkdir(exist_ok=True)

        # Transform the lyrics
        transformed_lyrics = transform_lyrics(remix_request.lyrics, remix_request.transform_style)

        if transformed_lyrics:
            # Create a version identifier
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            version_file = versions_dir / f"version_{timestamp}.json"
            
            # Save the transformed version with metadata
            version_data = {
                "style": remix_request.transform_style,
                "lyrics": transformed_lyrics,
                "timestamp": timestamp
            }
            
            with open(version_file, 'w', encoding='utf-8') as f:
                json.dump(version_data, f, ensure_ascii=False, indent=2)

            # Update the active connection with the result
            if remix_request.session_id in active_connections:
                await active_connections[remix_request.session_id].send_json({
                    "stage": "complete",
                    "data": {
                        "transformed_lyrics": transformed_lyrics,
                        "version_id": f"version_{timestamp}"
                    }
                })

        return {"status": "processing"}

    except Exception as e:
        logging.error(f"Error in remix: {str(e)}")
        if remix_request.session_id in active_connections:
            await active_connections[remix_request.session_id].send_json({
                "stage": "error",
                "message": str(e)
            })
        raise HTTPException(status_code=500, detail=str(e))


# In main.py, update the fetch-lyrics endpoint

@app.post("/api/fetch-lyrics")
async def fetch_lyrics(request: LyricsRequest) -> Response:
    logging.info(f"Received lyrics request for {request.artist} - {request.song_title}")
    try:
        # Create directories and files path
        artist_dir = sanitize_name(request.artist)
        song_dir = sanitize_name(request.song_title)
        song_path = DOWNLOADS_DIR / artist_dir / song_dir
        logging.info(f"Using song path: {song_path}")
        
        song_path.mkdir(parents=True, exist_ok=True)
        lyrics_file = song_path / "original_lyrics.txt"
        
        # If lyrics already exist in directory, read them
        if lyrics_file.exists():
            logging.info("Found existing lyrics file")
            with open(lyrics_file, 'r', encoding='utf-8') as f:
                lyrics = f.read()
            return Response(
                content=LyricsResponse(lyrics=lyrics).json(),
                headers={"X-Cached": "true"},
                media_type="application/json"
            )
        
        # Check cache
        cache_key = get_lyrics_cache_key(request.artist, request.song_title)
        is_cached, cached_lyrics = check_cached_lyrics(cache_key)
        logging.info(f"Cache check - is_cached: {is_cached}")
        
        if is_cached and cached_lyrics:
            logging.info("Using cached lyrics")
            with open(lyrics_file, 'w', encoding='utf-8') as f:
                f.write(cached_lyrics)
                
            return Response(
                content=LyricsResponse(lyrics=cached_lyrics).json(),
                headers={"X-Cached": "true"},
                media_type="application/json"
            )
        
        # Fetch from Genius
        logging.info("Fetching lyrics from Genius")
        lyrics = fetch_lyrics_from_genius(
            request.artist,
            request.song_title,
            os.getenv('GENIUS_TOKEN')
        )
        
        logging.info(f"Genius API response - lyrics found: {bool(lyrics)}")
        
        if not lyrics:
            logging.warning("No lyrics found")
            return Response(
                content=LyricsResponse(lyrics="", error="Lyrics not found").json(),
                headers={"X-Cached": "false"},
                media_type="application/json"
            )
        
        # Save to directory
        logging.info(f"Saving lyrics to {lyrics_file}")
        with open(lyrics_file, 'w', encoding='utf-8') as f:
            f.write(lyrics)
        
        # Save to cache
        save_lyrics_to_cache(cache_key, request.artist, request.song_title, lyrics)
        
        return Response(
            content=LyricsResponse(lyrics=lyrics).json(),
            headers={"X-Cached": "false"},
            media_type="application/json"
        )
            
    except Exception as e:
        logging.error(f"Error in fetch_lyrics: {str(e)}")
        return Response(
            content=LyricsResponse(lyrics="", error=str(e)).json(),
            headers={"X-Cached": "false"},
            media_type="application/json"
        )

@app.get("/api/lyrics/versions/{artist}/{song}")
async def get_lyrics_versions(artist: str, song: str):
    try:
        artist_dir = sanitize_name(artist)
        song_dir = sanitize_name(song)
        versions_dir = DOWNLOADS_DIR / artist_dir / song_dir / "versions"
        
        if not versions_dir.exists():
            return {"versions": []}

        versions = []
        for version_file in versions_dir.glob("version_*.json"):
            try:
                with open(version_file, 'r', encoding='utf-8') as f:
                    version_data = json.load(f)
                    versions.append({
                        "id": version_file.stem,
                        "style": version_data["style"],
                        "lyrics": version_data["lyrics"],
                        "timestamp": version_data["timestamp"]
                    })
            except Exception as e:
                logging.error(f"Error reading version file {version_file}: {e}")

        # Sort versions by timestamp
        versions.sort(key=lambda x: x["timestamp"], reverse=True)
        return {"versions": versions}

    except Exception as e:
        logging.error(f"Error getting versions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/download-audio")
async def download_audio(request: DownloadRequest) -> JSONResponse:
    try:
        # Create artist/song directory structure
        artist_dir = sanitize_name(request.artist)
        song_dir = sanitize_name(request.song_title)
        song_path = DOWNLOADS_DIR / artist_dir / song_dir
        song_path.mkdir(parents=True, exist_ok=True)
        
        # Check if file already exists
        mp3_path = song_path / "original.mp3"
        if mp3_path.exists():
            return JSONResponse({
                "mp3Path": f"/audio/{artist_dir}/{song_dir}/original.mp3"
            })
        
        # Download to temp directory first
        session_id = str(uuid.uuid4())
        status_handler = StatusHandler(session_id)
        temp_dir = TEMP_DIR / session_id / "input"
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        # Download the file
        downloaded_file = await download_song_with_progress(
            request.youtube_url, 
            str(temp_dir), 
            status_handler
        )
        
        if not downloaded_file:
            return JSONResponse(
                content={"error": "Failed to download audio"},
                status_code=400
            )
        
        # Move file to final location
        shutil.copy2(downloaded_file, mp3_path)
        
        # Clean up temp directory
        shutil.rmtree(temp_dir.parent)
        
        return JSONResponse({
            "mp3Path": f"/audio/{artist_dir}/{song_dir}/original.mp3"
        })
        
    except Exception as e:
        logging.error(f"Download error: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )
       
@app.post("/api/split-audio")
async def split_audio(request: SplitRequest) -> JSONResponse:
    try:
        # Get paths
        artist_dir = sanitize_name(request.artist)
        song_dir = sanitize_name(request.song_title)
        song_path = DOWNLOADS_DIR / artist_dir / song_dir
        
        # Check if split files already exist
        vocals_path = song_path / "vocals.wav"
        instrumental_path = song_path / "instrumental.wav"
        
        if vocals_path.exists() and instrumental_path.exists():
            return JSONResponse({
                "vocalsPath": f"/audio/{artist_dir}/{song_dir}/vocals.wav",
                "instrumentalPath": f"/audio/{artist_dir}/{song_dir}/instrumental.wav"
            })
            
        # Get the original MP3 path
        mp3_path = song_path / "original.mp3"
        if not mp3_path.exists():
            return JSONResponse(
                content={"error": "Original audio file not found"},
                status_code=400
            )
            
        # Process the audio in temp directory
        session_id = str(uuid.uuid4())
        status_handler = StatusHandler(session_id)
        temp_dir = TEMP_DIR / session_id / "output"
        temp_dir.mkdir(parents=True, exist_ok=True)

        temp_vocals, temp_instrumental = await process_audio_with_progress(
            str(mp3_path),
            str(temp_dir),
            status_handler
        )
        
        if not temp_vocals or not temp_instrumental:
            return JSONResponse(
                content={"error": "Failed to process audio"},
                status_code=400
            )
            
        # Move files to final location
        shutil.copy2(temp_vocals, vocals_path)
        shutil.copy2(temp_instrumental, instrumental_path)
        
        # Clean up temp directory
        shutil.rmtree(temp_dir.parent)
        
        return JSONResponse({
            "vocalsPath": f"/audio/{artist_dir}/{song_dir}/vocals.wav",
            "instrumentalPath": f"/audio/{artist_dir}/{song_dir}/instrumental.wav"
        })
        
    except Exception as e:
        logging.error(f"Error in split_audio: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )
@app.get("/api/library")
async def get_library():
    """Scans the downloads directory and returns the library structure."""
    if not DOWNLOADS_DIR.exists():
        DOWNLOADS_DIR.mkdir(parents=True)
        
    library = []
    
    # Scan the downloads directory
    for artist_dir in DOWNLOADS_DIR.iterdir():
        if artist_dir.is_dir():
            songs = []
            
            # Scan each artist's directory for songs
            for song_dir in artist_dir.iterdir():
                if song_dir.is_dir():
                    # Check for audio files
                    mp3_path = song_dir / "original.mp3"
                    vocals_path = song_dir / "vocals.wav"
                    instrumental_path = song_dir / "instrumental.wav"
                    
                    song_item = {
                        "name": song_dir.name,
                        "hasOriginal": mp3_path.exists(),
                        "hasSplitFiles": vocals_path.exists() and instrumental_path.exists(),
                        "files": {
                            # Remove 'downloads' from the paths
                            "mp3Path": f"/audio/{artist_dir.name}/{song_dir.name}/original.mp3" if mp3_path.exists() else None,
                            "vocalsPath": f"/audio/{artist_dir.name}/{song_dir.name}/vocals.wav" if vocals_path.exists() else None,
                            "instrumentalPath": f"/audio/{artist_dir.name}/{song_dir.name}/instrumental.wav" if instrumental_path.exists() else None
                        }
                    }
                    songs.append(song_item)
            
            if songs:
                artist_item = {
                    "name": artist_dir.name,
                    "children": sorted(songs, key=lambda x: x["name"])
                }
                library.append(artist_item)
    
    return {"library": sorted(library, key=lambda x: x["name"])}


@app.get("/api/test")
async def test_endpoint():
    return {"message": "Backend is connected!"}