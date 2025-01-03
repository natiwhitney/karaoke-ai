import logging
import yt_dlp
import os
import asyncio
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def download_song_with_progress(youtube_url: str, output_path: str, status_handler) -> str:
    try:
        Path(output_path).mkdir(parents=True, exist_ok=True)
        logger.info(f"Starting download from {youtube_url}")
        
        # Create a list to track async tasks
        progress_tasks = []
        
        async def async_progress_hook(d):
            try:
                if d['status'] == 'downloading':
                    total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
                    downloaded = d.get('downloaded_bytes', 0)
                    speed = d.get('speed', 0)
                    
                    if total > 0:
                        progress = (downloaded / total) * 100
                        speed_str = f"{speed/1024/1024:.1f} MB/s" if speed else None
                        await status_handler.update_download(progress, speed_str)
                        logger.debug(f"Download progress: {progress:.1f}%")
                    
                elif d['status'] == 'finished':
                    await status_handler.send_status("converting", 0, "Converting audio format...")
                    logger.info("Download finished, starting conversion")
            except Exception as e:
                logger.error(f"Error in progress hook: {str(e)}")

        def progress_hook(d):
            task = asyncio.create_task(async_progress_hook(d))
            progress_tasks.append(task)

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

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # First extract info to get the expected filename
                info = ydl.extract_info(youtube_url, download=False)
                filename = ydl.prepare_filename(info)
                expected_mp3 = str(Path(filename).with_suffix('.mp3'))
                
                # Perform the actual download
                ydl.download([youtube_url])
                
                # Wait for all progress tasks to complete
                await asyncio.gather(*progress_tasks, return_exceptions=True)
                
                # Verify the file exists
                if os.path.exists(expected_mp3):
                    await status_handler.send_status("complete", 100, "Download complete")
                    logger.info(f"Successfully downloaded to: {expected_mp3}")
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