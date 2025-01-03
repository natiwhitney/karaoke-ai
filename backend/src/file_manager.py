from pathlib import Path
import shutil
import json
from datetime import datetime
from typing import Optional, Dict, Tuple, List
import hashlib
import logging
import os

class FileManager:
    def __init__(self, base_dir: str = "."):
        """
        Initialize the file management system.
        
        Args:
            base_dir (str): Base directory for the application
        """
        self.base_dir = Path(base_dir)
        self.downloads_dir = self.base_dir / "downloads"
        self.temp_dir = self.base_dir / "temp"
        self.cache_dir = self.temp_dir / "cache"
        
        # Ensure directories exist
        self.downloads_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize logging
        self.logger = logging.getLogger(__name__)

    def get_session_dirs(self, session_id: str) -> Tuple[Path, Path]:
        """Get input and output directories for a session."""
        session_dir = self.temp_dir / session_id
        input_dir = session_dir / "input"
        output_dir = session_dir / "output"
        
        input_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        return input_dir, output_dir

    def get_artist_song_dir(self, artist: str, song_title: str) -> Path:
        """Get the directory for an artist/song combination."""
        safe_artist = self._sanitize_name(artist)
        safe_title = self._sanitize_name(song_title)
        return self.downloads_dir / safe_artist / safe_title

    def _sanitize_name(self, name: str) -> str:
        """Sanitize a name for use in file paths."""
        return "".join(c for c in name if c.isalnum() or c in " -_").strip().replace(" ", "_")

    def get_url_hash(self, url: str) -> str:
        """Generate a hash for a URL."""
        cleaned_url = url.split("&")[0]  # Remove parameters
        return hashlib.md5(cleaned_url.encode()).hexdigest()

    def check_cache(self, url: str) -> Tuple[bool, Optional[Dict[str, str]]]:
        """
        Check if files for a URL exist in cache.
        
        Returns:
            Tuple[bool, Optional[Dict[str, str]]]: (is_cached, file_paths)
        """
        url_hash = self.get_url_hash(url)
        cache_dir = self.cache_dir / url_hash
        
        required_files = {
            "original": "original.mp3",
            "vocals": "vocals.wav",
            "instrumental": "instrumental.wav"
        }
        
        if not cache_dir.exists():
            return False, None
            
        cached_files = {}
        for key, filename in required_files.items():
            file_path = cache_dir / filename
            if file_path.exists():
                cached_files[key] = str(file_path)
            else:
                return False, None
                
        return True, cached_files

    def save_to_cache(self, url: str, files: Dict[str, Path]) -> None:
        """
        Save files to cache.
        
        Args:
            url (str): Source URL
            files (Dict[str, Path]): Dictionary of file types and their paths
        """
        url_hash = self.get_url_hash(url)
        cache_dir = self.cache_dir / url_hash
        cache_dir.mkdir(parents=True, exist_ok=True)
        
        for file_type, src_path in files.items():
            if isinstance(src_path, (str, Path)) and Path(src_path).exists():
                dest_path = cache_dir / f"{file_type}{Path(src_path).suffix}"
                shutil.copy2(src_path, dest_path)
                self.logger.info(f"Cached {file_type} to {dest_path}")

    def save_to_downloads(
        self,
        artist: str,
        song_title: str,
        files: Dict[str, Path],
        metadata: Optional[Dict] = None
    ) -> Dict[str, str]:
        """
        Save files to the downloads directory and update metadata.
        
        Args:
            artist (str): Artist name
            song_title (str): Song title
            files (Dict[str, Path]): Dictionary of file types and their paths
            metadata (Optional[Dict]): Additional metadata to store
            
        Returns:
            Dict[str, str]: Paths to saved files
        """
        downloads_dir = self.get_artist_song_dir(artist, song_title)
        downloads_dir.mkdir(parents=True, exist_ok=True)
        
        saved_paths = {}
        for file_type, src_path in files.items():
            if isinstance(src_path, (str, Path)) and Path(src_path).exists():
                dest_path = downloads_dir / f"{file_type}{Path(src_path).suffix}"
                shutil.copy2(src_path, dest_path)
                saved_paths[file_type] = str(dest_path)
                self.logger.info(f"Saved {file_type} to {dest_path}")
        
        # Update metadata
        self._update_metadata(artist, song_title, saved_paths, metadata)
        
        return saved_paths

    def _update_metadata(
        self,
        artist: str,
        song_title: str,
        file_paths: Dict[str, str],
        additional_metadata: Optional[Dict] = None
    ) -> None:
        """Update the metadata file with new information."""
        metadata_path = self.downloads_dir / "metadata.json"
        
        try:
            if metadata_path.exists():
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
            else:
                metadata = {}
            
            safe_artist = self._sanitize_name(artist)
            safe_title = self._sanitize_name(song_title)
            
            if safe_artist not in metadata:
                metadata[safe_artist] = {}
                
            metadata[safe_artist][safe_title] = {
                "title": song_title,
                "artist": artist,
                "files": file_paths,
                "date_added": datetime.now().isoformat(),
                **(additional_metadata or {})
            }
            
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
                
        except Exception as e:
            self.logger.error(f"Error updating metadata: {e}")

    def cleanup_session(self, session_id: str) -> None:
        """Clean up temporary session files."""
        session_dir = self.temp_dir / session_id
        if session_dir.exists():
            shutil.rmtree(session_dir)
            self.logger.info(f"Cleaned up session directory: {session_dir}")

    def cleanup_old_sessions(self, max_age_hours: int = 24) -> None:
        """Clean up old session directories."""
        current_time = datetime.now().timestamp()
        
        for session_dir in self.temp_dir.glob("*"):
            if session_dir.name != "cache" and session_dir.is_dir():
                creation_time = session_dir.stat().st_mtime
                age_hours = (current_time - creation_time) / 3600
                
                if age_hours > max_age_hours:
                    shutil.rmtree(session_dir)
                    self.logger.info(f"Removed old session directory: {session_dir}")

# Example usage
if __name__ == "__main__":
    fm = FileManager()
    fm.cleanup_old_sessions()