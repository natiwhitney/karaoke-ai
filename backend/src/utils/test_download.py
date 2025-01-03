import logging
import yt_dlp
import os
import asyncio
from pathlib import Path
from typing import Optional, Callable

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DownloadStatus:
    def __init__(self):
        self.progress = 0
        self.speed = None
        self.eta = None
        self.status = 'initializing'
        self.filename = None
        self.error = None

async def download_song_with_progress(
    youtube_url: str, 
    output_path: str, 
    status_handler
) -> Optional[str]:
    """
    Download a song from YouTube with progress tracking.
    
    Args:
        youtube_url (str): The YouTube URL to download from
        output_path (str): Directory to save the downloaded file
        status_handler: Object with update methods for progress tracking
    
    Returns:
        Optional[str]: Path to downloaded file if successful, None otherwise
    """
    try:
        # Ensure output directory exists
        output_dir = Path(output_path)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Starting download from {youtube_url}")
        logger.info(f"Output directory: {output_path}")

        download_status = DownloadStatus()

        async def async_progress_hook(d):
            """Async progress hook for download updates"""
            try:
                if d['status'] == 'downloading':
                    # Calculate download progress
                    total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
                    downloaded = d.get('downloaded_bytes', 0)
                    speed = d.get('speed', 0)
                    
                    if total_bytes > 0:
                        progress = (downloaded / total_bytes) * 100
                        speed_str = f"{speed/1024/1024:.1f} MB/s" if speed else "calculating..."
                        
                        logger.debug(f"Download progress: {progress:.1f}% at {speed_str}")
                        await status_handler.update_download(progress, speed_str)
                
                elif d['status'] == 'finished':
                    logger.info("Download finished, converting format...")
                    await status_handler.send_status(
                        "converting", 
                        100, 
                        "Converting to MP3..."
                    )
                    
            except Exception as e:
                logger.error(f"Error in progress hook: {str(e)}")
                download_status.error = str(e)

        def progress_hook(d):
            """Synchronous wrapper for async progress hook"""
            asyncio.create_task(async_progress_hook(d))

        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(output_path, '%(title)s.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'progress_hooks': [progress_hook],
            'quiet': True,
            'no_warnings': True
        }

        logger.info("Initializing yt-dlp with options")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                # Extract info first to get the title
                info = ydl.extract_info(youtube_url, download=False)
                filename = ydl.prepare_filename(info)
                expected_mp3 = str(Path(filename).with_suffix('.mp3'))
                
                logger.info(f"Starting download of: {info.get('title', 'Unknown title')}")
                
                # Perform the actual download
                ydl.download([youtube_url])
                
                if os.path.exists(expected_mp3):
                    logger.info(f"Successfully downloaded to: {expected_mp3}")
                    await status_handler.send_status(
                        "complete", 
                        100, 
                        "Download and conversion complete"
                    )
                    return expected_mp3
                else:
                    raise FileNotFoundError(f"Expected MP3 file not found: {expected_mp3}")
                
            except Exception as e:
                logger.error(f"Error during download: {str(e)}")
                raise

    except Exception as e:
        error_msg = f"Download error: {str(e)}"
        logger.error(error_msg)
        await status_handler.send_error(error_msg)
        return None

# Test status handler class for standalone testing
class TestStatusHandler:
    async def update_download(self, progress: float, speed: str = None):
        print(f"Download progress: {progress:.1f}% Speed: {speed}")
    
    async def send_status(self, stage: str, progress: float, message: str):
        print(f"Status: {stage} - {progress}% - {message}")
    
    async def send_error(self, error_msg: str):
        print(f"Error: {error_msg}")

# Test function
async def test_download():
    """Test function to verify download functionality"""
    test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"  # Test video
    test_output = "test_downloads"
    handler = TestStatusHandler()
    
    try:
        result = await download_song_with_progress(test_url, test_output, handler)
        if result:
            print(f"Success! Downloaded file: {result}")
            return True
        return False
    except Exception as e:
        print(f"Test failed: {str(e)}")
        return False

if __name__ == "__main__":
    # Run the test
    asyncio.run(test_download())