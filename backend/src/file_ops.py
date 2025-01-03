import os
import re
import shutil
from pathlib import Path


def sanitize_name(name):
    """Sanitize the artist or song title for use in file paths."""
    return re.sub(r'[^\w\s-]', '', name).replace(" ", "_")

def ensure_directory(path):
    """Ensure the directory exists."""
    if not os.path.exists(path):
        os.makedirs(path)

def generate_file_path(base_dir, artist, song_title, file_type, extension):
    """Generate a file path based on artist, song title, and type."""
    artist_dir = sanitize_name(artist)
    song_dir = sanitize_name(song_title)
    return os.path.join(base_dir, artist_dir, song_dir, f"{file_type}.{extension}")

def save_file(file_path, content):
    """Save content to a file."""
    ensure_directory(os.path.dirname(file_path))
    with open(file_path, "wb") as f:
        f.write(content)

def save_to_artist_directory(base_path, artist, song_title, downloaded_file_path):
    """Save the downloaded MP3 file in the artist/song directory."""
    artist_dir = Path(base_path) / sanitize_name(artist)
    song_dir = artist_dir / sanitize_name(song_title)
    song_dir.mkdir(parents=True, exist_ok=True)

    # Save the MP3 file
    target_path = song_dir / "original.mp3"
    shutil.copy2(downloaded_file_path, target_path)

    print(f"File saved to: {target_path}")
    return target_path