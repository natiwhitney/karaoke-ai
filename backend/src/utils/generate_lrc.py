import librosa
import numpy as np
import json
from pathlib import Path

def analyze_vocal_presence(vocals_path, rms_threshold=0.01, smooth_window=3):
    """
    Analyze vocal presence in half-second increments with smoothing.

    Args:
        vocals_path (str): Path to the vocals audio file.
        rms_threshold (float): Minimum RMS energy to classify as vocal.
        smooth_window (int): Sliding window size for smoothing.

    Returns:
        list: A list of 1s (vocals) and 0s (no vocals) for each half-second.
        float: Duration of the audio file in seconds.
    """
    # Load vocals file
    y, sr = librosa.load(vocals_path, sr=None)

    # Total duration of the audio file
    duration = librosa.get_duration(y=y, sr=sr)

    # Frame length for 0.5 seconds
    frame_length = sr // 2
    hop_length = sr // 2

    # Calculate RMS energy
    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length).flatten()

    # Classify as vocal (1) or non-vocal (0) based on threshold
    vocal_presence = np.array([1 if energy > rms_threshold else 0 for energy in rms])

    # Smooth the output using a sliding window
    smoothed = np.convolve(vocal_presence, np.ones(smooth_window, dtype=int), mode="same")
    smoothed = [1 if val > smooth_window // 2 else 0 for val in smoothed]

    return smoothed, duration

def group_vocal_segments(vocal_presence, duration, increment=0.5):
    """
    Group contiguous vocal segments into start, end, and vocal status.

    Args:
        vocal_presence (list): List of 1s and 0s indicating vocal presence.
        duration (float): Total duration of the audio file.
        increment (float): Time increment for each frame in seconds.

    Returns:
        list: A list of dictionaries with grouped time ranges and vocal status.
    """
    segments = []
    current_start = 0.0
    current_vocal = vocal_presence[0]

    for i, presence in enumerate(vocal_presence[1:], start=1):
        time = i * increment
        if presence != current_vocal:  # Transition to a new state
            segments.append({
                "start": round(current_start, 2),
                "end": round(time, 2),
                "vocal": "true" if current_vocal == 1 else "false"
            })
            current_start = time
            current_vocal = presence

    # Add the final segment
    segments.append({
        "start": round(current_start, 2),
        "end": round(duration, 2),
        "vocal": "true" if current_vocal == 1 else "false"
    })

    return segments

def main():
    # Define test directory and file paths
    test_dir = Path("./test_dir")
    vocals_file = test_dir / "vocals.wav"
    output_file = test_dir / "vocal_segments_with_vocal_flag.json"

    # Check for required file
    if not vocals_file.exists():
        print("Missing 'vocals.wav'. Ensure the file is in 'test_dir'.")
        return

    # Analyze vocal presence
    print("Analyzing vocal presence...")
    vocal_presence, duration = analyze_vocal_presence(str(vocals_file))

    # Group vocal segments
    segments = group_vocal_segments(vocal_presence, duration)

    # Write output to JSON file
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(segments, f, indent=4)

    print(f"Vocal segments with vocal flag written to: {output_file}")

if __name__ == "__main__":
    main()