from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pathlib import Path
import asyncio
import os
import uuid
from typing import Optional

from src.download import download_song
from src.lyrics import fetch_lyrics_from_genius
from src.remix import transform_lyrics
from src.audio import process_audio
from src.lyrics import fetch_lyrics_from_genius

app = FastAPI()
temp_dir = Path("temp")
temp_dir.mkdir(exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/audio", StaticFiles(directory="temp"), name="audio")
active_connections: dict[str, WebSocket] = {}

class RemixRequest(BaseModel):
    youtube_url: Optional[str] = None
    artist_name: Optional[str] = None
    song_title: Optional[str] = None
    transform_style: str = "A song about US capitalism"
    lyrics: Optional[str] = None
    session_id: str  # Add this field
    custom_prompt: Optional[str] = None  # New field


class ProcessingStatus(BaseModel):
    stage: str
    progress: float
    message: str
    data: Optional[dict] = None

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

async def transform_and_notify(lyrics: str, style: str, session_id: str, base_dir: Path):
    try:
        print("Starting transformation process...")  # Debug log
        transformed_lyrics = transform_lyrics(lyrics, style)
        
        # Save transformed lyrics
        lyrics_dir = base_dir / "lyrics"
        lyrics_dir.mkdir(exist_ok=True)
        with open(lyrics_dir / "transformed.txt", "w", encoding='utf-8') as f:
            f.write(transformed_lyrics)
        
        print(f"Sending transformed lyrics via WebSocket...")  # Debug log
        await update_status(session_id, ProcessingStatus(
            stage="complete",
            progress=100,
            message="Transform complete",
            data={
                "original_lyrics": lyrics,
                "transformed_lyrics": transformed_lyrics
            }
        ))
        print("WebSocket message sent")  # Debug log
        
        return transformed_lyrics

    except Exception as e:
        print(f"Error in transform_and_notify: {e}")  # Debug log
        await update_status(session_id, ProcessingStatus(
            stage="error",
            progress=0,
            message=f"Transform error: {str(e)}"
        ))
        raise

async def process_audio_and_notify(youtube_url: str, base_dir: Path, session_id: str):
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

    await update_status(session_id, ProcessingStatus(
        stage="audio_complete",
        progress=100,
        message="Audio processing complete",
        data={
            "vocals_path": f"/audio/{session_id}/output/vocals.wav",
            "instrumental_path": f"/audio/{session_id}/output/instrumental.wav"
        }
    ))

@app.post("/api/remix")
async def create_remix(
    remix_request: RemixRequest, 
    background_tasks: BackgroundTasks
):
    """Start the remix process after WebSocket is established"""
    session_id = remix_request.session_id
    
    # Wait a moment to ensure WebSocket is connected
    for _ in range(5):  # Try for up to 0.5 seconds
        if session_id in active_connections:
            break
        await asyncio.sleep(0.1)
    
    if session_id not in active_connections:
        raise HTTPException(status_code=400, detail="WebSocket connection not established")
    
    # Now start processing
    background_tasks.add_task(process_remix, remix_request, session_id)
    return {"status": "processing", "session_id": session_id}


# Add new model definitions with existing ones
class LyricsRequest(BaseModel):
    artist: str
    song_title: str

class LyricsResponse(BaseModel):
    lyrics: str
    error: Optional[str] = None

@app.post("/api/fetch-lyrics")
async def fetch_lyrics(request: LyricsRequest, background_tasks: BackgroundTasks) -> LyricsResponse:
    """Endpoint to fetch lyrics using Genius API"""
    try:
        lyrics = fetch_lyrics_from_genius(
            request.artist,
            request.song_title,
            os.getenv('GENIUS_TOKEN')
        )
        
        if not lyrics:
            return LyricsResponse(
                lyrics="",
                error="Lyrics not found"
            )
            
        return LyricsResponse(lyrics=lyrics)
    except Exception as e:
        return LyricsResponse(
            lyrics="",
            error=str(e)
        )

async def process_remix(remix_request: RemixRequest, session_id: str):
    base_dir = Path("temp") / session_id
    base_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Get lyrics
        lyrics = remix_request.lyrics
        if not lyrics and remix_request.artist_name and remix_request.song_title:
            lyrics = fetch_lyrics_from_genius(
                remix_request.artist_name,
                remix_request.song_title,
                os.getenv('GENIUS_TOKEN')
            )

        if not lyrics:
            raise HTTPException(status_code=400, detail="No lyrics available")

        print(f"Starting transformation for session {session_id}")  # Debug log
        
        # Use custom prompt if available, else fallback to transform_style
        prompt_to_use = remix_request.custom_prompt or remix_request.transform_style

        transformed_lyrics = await transform_and_notify(
            lyrics, 
            prompt_to_use,  # Pass the prompt
            session_id, 
            base_dir
)

        
        print(f"Transformation complete for session {session_id}")  # Debug log

        # No need to send another complete status since transform_and_notify does it

    except Exception as e:
        print(f"Error in process_remix: {str(e)}")  # Debug log
        await update_status(session_id, ProcessingStatus(
            stage="error",
            progress=0,
            message=str(e)
        ))
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/api/test")
async def test_endpoint():
    return {"message": "Backend is connected!"}