import whisper
from pathlib import Path

def transcribe_audio(input_file):
    model = whisper.load_model("base")  # You can use "tiny", "small", "medium", "large" based on your resources
    result = model.transcribe(input_file)
    return result

def save_transcription(result, output_dir):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save text and timecodes
    text_file = output_dir / "transcription.txt"
    with open(text_file, "w", encoding="utf-8") as f:
        f.write(result["text"])

    segments_file = output_dir / "segments.json"
    with open(segments_file, "w", encoding="utf-8") as f:
        import json
        json.dump(result["segments"], f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    input_audio = "./test_dir/vocals.wav"  # Replace with the path to your audio file
    output_dir = "transcriptions"

    print("Transcribing audio...")
    transcription_result = transcribe_audio(input_audio)
    save_transcription(transcription_result, output_dir)

    print(f"Transcription completed. Results saved to {output_dir}/")