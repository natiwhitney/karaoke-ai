from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pathlib import Path
import shutil
import hashlib
import json
from datetime import datetime
import asyncio
import os
import uuid
from typing import Optional

from src.download import download_song
from src.lyrics import fetch_lyrics_from_genius
from src.remix import transform_lyrics
from src.audio import process_audio

app = FastAPI()
temp_dir = Path("temp")
temp_dir.mkdir(exist_ok=True)
cache_dir = temp_dir / "cache"
cache_dir.mkdir(exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/audio", StaticFiles(directory="temp"), name="audio")
active_connections: dict[str, WebSocket] = {}

# Base Models
class ProcessingStatus(BaseModel):
    stage: str
    progress: float
    message: str
    data: Optional[dict] = None

# Remix-related Models
class RemixRequest(BaseModel):
    youtube_url: Optional[str] = None
    artist_name: Optional[str] = None
    song_title: Optional[str] = None
    transform_style: str = "A song about US capitalism"
    lyrics: Optional[str] = None
    session_id: str
    custom_prompt: Optional[str] = None

class LyricsRequest(BaseModel):
    artist: str
    song_title: str

class LyricsResponse(BaseModel):
    lyrics: str
    error: Optional[str] = None

# Split-related Models
class SplitRequest(BaseModel):
    youtube_url: str

class SplitResponse(BaseModel):
    vocalsPath: str
    instrumentalPath: str
    error: Optional[str] = None

async def update_status(session_id: str, status: ProcessingStatus):
    if session_id in active_connections:
        await active_connections[session_id].send_json(status.dict())

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

# Transform and Audio Processing Functions (Existing)
async def transform_and_notify(lyrics: str, style: str, session_id: str, base_dir: Path):
    try:
        transformed_lyrics = transform_lyrics(lyrics, style)
        
        lyrics_dir = base_dir / "lyrics"
        lyrics_dir.mkdir(exist_ok=True)
        with open(lyrics_dir / "transformed.txt", "w", encoding='utf-8') as f:
            f.write(transformed_lyrics)
        
        await update_status(session_id, ProcessingStatus(
            stage="complete",
            progress=100,
            message="Transform complete",
            data={
                "original_lyrics": lyrics,
                "transformed_lyrics": transformed_lyrics
            }
        ))
        
        return transformed_lyrics

    except Exception as e:
        await update_status(session_id, ProcessingStatus(
            stage="error",
            progress=0,
            message=f"Transform error: {str(e)}"
        ))
        raise

async def process_audio_and_notify(youtube_url: str, base_dir: Path, session_id: str):
    try:
        await update_status(session_id, ProcessingStatus(
            stage="download",
            progress=0,
            message="Starting download..."
        ))
        
        input_dir = base_dir / "input"
        downloaded_file = download_song(youtube_url, str(input_dir))
        
        if not downloaded_file:
            raise HTTPException(status_code=400, detail="Failed to download audio")

        await update_status(session_id, ProcessingStatus(
            stage="download",
            progress=100,
            message="Download complete"
        ))

        await update_status(session_id, ProcessingStatus(
            stage="audio",
            progress=0,
            message="Processing audio..."
        ))
        
        output_dir = base_dir / "output"
        vocals_path, instrumental_path = process_audio(downloaded_file, str(output_dir))
        
        if not vocals_path or not instrumental_path:
            raise HTTPException(status_code=400, detail="Failed to process audio")

        return vocals_path, instrumental_path

    except Exception as e:
        await update_status(session_id, ProcessingStatus(
            stage="error",
            progress=0,
            message=str(e)
        ))
        raise


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

# Existing Endpoints
@app.post("/api/remix")
async def create_remix(remix_request: RemixRequest, background_tasks: BackgroundTasks):
    session_id = remix_request.session_id
    
    for _ in range(5):
        if session_id in active_connections:
            break
        await asyncio.sleep(0.1)
    
    if session_id not in active_connections:
        raise HTTPException(status_code=400, detail="WebSocket connection not established")
    
    background_tasks.add_task(process_remix, remix_request, session_id)
    return {"status": "processing", "session_id": session_id}

@app.post("/api/fetch-lyrics")
async def fetch_lyrics(request: LyricsRequest) -> LyricsResponse:
    try:
        lyrics = fetch_lyrics_from_genius(
            request.artist,
            request.song_title,
            os.getenv('GENIUS_TOKEN')
        )
        
        if not lyrics:
            return LyricsResponse(lyrics="", error="Lyrics not found")
            
        return LyricsResponse(lyrics=lyrics)
    except Exception as e:
        return LyricsResponse(lyrics="", error=str(e))

async def process_remix(remix_request: RemixRequest, session_id: str):
    base_dir = Path("temp") / session_id
    base_dir.mkdir(parents=True, exist_ok=True)

    try:
        lyrics = remix_request.lyrics
        if not lyrics and remix_request.artist_name and remix_request.song_title:
            lyrics = fetch_lyrics_from_genius(
                remix_request.artist_name,
                remix_request.song_title,
                os.getenv('GENIUS_TOKEN')
            )

        if not lyrics:
            raise HTTPException(status_code=400, detail="No lyrics available")

        prompt_to_use = remix_request.custom_prompt or remix_request.transform_style
        transformed_lyrics = await transform_and_notify(lyrics, prompt_to_use, session_id, base_dir)

        if remix_request.youtube_url:
            vocals_path, instrumental_path = await process_audio_and_notify(
                remix_request.youtube_url, 
                base_dir, 
                session_id
            )
            
            # Send final completion status with all data
            await update_status(session_id, ProcessingStatus(
                stage="complete",
                progress=100,
                message="Processing complete",
                data={
                    "original_lyrics": lyrics,
                    "transformed_lyrics": transformed_lyrics,
                    "vocals_path": f"/audio/{session_id}/output/vocals.wav",
                    "instrumental_path": f"/audio/{session_id}/output/instrumental.wav"
                }
            ))

    except Exception as e:
        await update_status(session_id, ProcessingStatus(
            stage="error",
            progress=0,
            message=str(e)
        ))
        raise HTTPException(status_code=500, detail=str(e))

# New Split Audio Endpoint
@app.post("/api/split-audio")
async def split_audio(request: SplitRequest) -> SplitResponse:
    try:
        # Check cache first
        url_hash = get_url_hash(request.youtube_url)
        is_cached, cached_vocals, cached_instrumental = check_cached_audio(url_hash)
        
        if is_cached and cached_vocals and cached_instrumental:
            print(f"Returning cached files for {url_hash}")
            return Response(
                content=SplitResponse(
                    vocalsPath=cached_vocals,
                    instrumentalPath=cached_instrumental
                ).json(),
                headers={"X-Cached": "true"},
                media_type="application/json"
            )
        
        # If not cached, process normally
        session_id = str(uuid.uuid4())
        base_dir = Path("temp") / session_id
        base_dir.mkdir(parents=True, exist_ok=True)
        
        input_dir = base_dir / "input"
        input_dir.mkdir(exist_ok=True)
        
        output_dir = base_dir / "output"
        output_dir.mkdir(exist_ok=True)
        
        # Process the audio
        downloaded_file = download_song(request.youtube_url, str(input_dir))
        if not downloaded_file:
            return SplitResponse(
                vocalsPath="",
                instrumentalPath="",
                error="Failed to download audio"
            )
        
        original_filename = Path(downloaded_file).stem
        vocals_path, instrumental_path = process_audio(downloaded_file, str(output_dir))
        
        if not vocals_path or not instrumental_path:
            return SplitResponse(
                vocalsPath="",
                instrumentalPath="",
                error="Failed to process audio"
            )
        
        # Define paths
        htdemucs_dir = output_dir / "htdemucs" / original_filename
        vocals_source = htdemucs_dir / "vocals.wav"
        instrumental_source = htdemucs_dir / "no_vocals.wav"
        vocals_dest = output_dir / "vocals.wav"
        instrumental_dest = output_dir / "instrumental.wav"
        
        # Copy files if they exist
        if vocals_source.exists() and instrumental_source.exists():
            shutil.copy2(str(vocals_source), str(vocals_dest))
            shutil.copy2(str(instrumental_source), str(instrumental_dest))
            print(f"Files copied successfully to {output_dir}")
            
            # Save to cache
            save_to_cache(url_hash, request.youtube_url, vocals_dest, instrumental_dest)
            
            return Response(
                content=SplitResponse(
                    vocalsPath=f"/audio/{session_id}/output/vocals.wav",
                    instrumentalPath=f"/audio/{session_id}/output/instrumental.wav"
                ).json(),
                headers={"X-Cached": "false"},
                media_type="application/json"
            )
        
        return SplitResponse(
            vocalsPath="",
            instrumentalPath="",
            error="Failed to find processed files"
        )
        
    except Exception as e:
        print(f"Error in split_audio: {str(e)}")
        return SplitResponse(
            vocalsPath="",
            instrumentalPath="",
            error=str(e)
        )


@app.get("/api/test")
async def test_endpoint():
    return {"message": "Backend is connected!"}