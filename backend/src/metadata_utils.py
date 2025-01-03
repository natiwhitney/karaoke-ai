import os
import json
import re

METADATA_FILENAME = "metadata.json"

def sanitize_name(name):
    """Sanitize the artist or song title for use in file paths."""
    if not name:
        raise ValueError("Name cannot be empty")
    return re.sub(r'[^\w\s-]', '', name).replace(" ", "_").strip()

def load_metadata(base_path):
    """Load existing metadata."""
    metadata_path = os.path.join(base_path, METADATA_FILENAME)
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, "r") as f:
                return json.load(f)
        except json.JSONDecodeError:
            print("Error: Corrupted metadata file. Returning an empty structure.")
            return {}
    return {}

def save_metadata(base_path, metadata):
    """Save updated metadata."""
    metadata_path = os.path.join(base_path, METADATA_FILENAME)
    try:
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=4)
    except IOError as e:
        print(f"Error saving metadata: {e}")

def update_metadata(base_path, artist, song_title, file_paths, lyrics_versions=None):
    """Update metadata with new song details."""
    if not artist or not song_title or not file_paths:
        raise ValueError("Artist, song title, and file paths are required")

    metadata = load_metadata(base_path)
    artist_key = sanitize_name(artist)
    song_key = sanitize_name(song_title)

    # Ensure artist exists in metadata
    if artist_key not in metadata:
        metadata[artist_key] = {}

    # Merge with existing song metadata, if it exists
    existing_metadata = metadata[artist_key].get(song_key, {})
    updated_metadata = {
        "title": song_title,
        "artist": artist,
        "audio_files": {**existing_metadata.get("audio_files", {}), **file_paths},
        "lyrics_versions": list(set(existing_metadata.get("lyrics_versions", []) + (lyrics_versions or []))),
    }
    metadata[artist_key][song_key] = updated_metadata

    # Save the updated metadata
    save_metadata(base_path, metadata)
    print(f"Metadata updated: {os.path.join(base_path, METADATA_FILENAME)}")
