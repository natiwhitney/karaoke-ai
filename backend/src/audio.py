import subprocess
import os
import sys
from pathlib import Path

def run_demucs(input_file, output_dir):
    """
    Runs Demucs to split an audio file into stems.

    Args:
        input_file (str): Path to the input audio file.
        output_dir (str): Directory to save the separated stems.
    """
    try:
        print("Running Demucs to split audio into stems...")
        command = [
            "demucs",
            "--two-stems=vocals",  # Split into vocals and accompaniment only
            "-n", "htdemucs",  # default model, one pass
            "-d", "cpu",          # Explicitly use CPU for consistent behavior
            "-o", output_dir,
            input_file
        ]
        subprocess.run(command, check=True)
        print(f"Demucs completed. Stems saved to: {output_dir}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error while running Demucs: {e}")
        return False

def process_audio(input_file, output_dir):
    """
    Main function to process audio file: split into stems.
    
    Args:
        input_file (str): Path to the input audio file
        output_dir (str): Directory to save processed files
        
    Returns:
        tuple: (vocals_path, instrumental_path) or (None, None) if processing fails
    """
    try:
        # Create output directory if it doesn't exist
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Ensure input file exists
        if not os.path.exists(input_file):
            print(f"Input file not found: {input_file}")
            return None, None
        
        # Run Demucs to split the audio into stems
        if not run_demucs(input_file, str(output_dir)):
            return None, None
        
        # Locate the output folder created by Demucs
        song_name = Path(input_file).stem
        demucs_stems_dir = output_dir / "htdemucs" / song_name
        
        # Define output paths (for two-stem separation)
        vocals_path = demucs_stems_dir / "vocals.wav"
        instrumental_path = demucs_stems_dir / "no_vocals.wav"
        
        if vocals_path.exists() and instrumental_path.exists():
            return str(vocals_path), str(instrumental_path)
        else:
            print("Stem files not found after processing")
            return None, None
            
    except Exception as e:
        print(f"Error processing audio: {e}")
        return None, None

if __name__ == "__main__":
    # Example usage
    input_audio_file = "./input/Green Day - American Idiot (Official Audio).mp3"
    output_directory = "output"
    
    vocals, instrumental = process_audio(input_audio_file, output_directory)
    if vocals and instrumental:
        print(f"Processing complete!")
        print(f"Vocals file: {vocals}")
        print(f"Instrumental file: {instrumental}")
    else:
        print("Processing failed!")