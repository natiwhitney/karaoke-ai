import logging
import yt_dlp
import os
from pathlib import Path

def download_song(youtube_url, output_path):
    """
    Downloads the audio stream of a YouTube video using yt-dlp.

    Args:
        youtube_url (str): The full YouTube video URL.
        output_path (str): The directory where the audio will be saved.

    Returns:
        str: Path of the downloaded audio file.
    """
    try:
        logging.info("Initializing yt-dlp to download audio.")
        
        # Create output directory if it doesn't exist
        Path(output_path).mkdir(parents=True, exist_ok=True)
        
        # Configure yt-dlp options
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(output_path, '%(title)s.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'quiet': False,
            'no_warnings': True
        }

        # Download the file and get info
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url)
            # Get the file path of the downloaded file
            downloaded_file = os.path.join(output_path, f"{info['title']}.mp3")
            logging.info(f"Audio downloaded to: {downloaded_file}")
            return downloaded_file

    except Exception as e:
        logging.exception("An error occurred while downloading audio.")
        return None