import subprocess
import os
import sys
from pathlib import Path
import logging
import asyncio
import signal
import shutil


async def process_audio_with_progress(input_file: str, output_dir: str, status_handler) -> tuple[str, str]:
    try:
        logging.info(f"Starting Demucs separation for {input_file}")
        await status_handler.send_status("processing", 0, "Initializing audio separation...")

        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Add environment variable for unbuffered output
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"

        command = [
            "demucs",
            "--two-stems=vocals",
            "-n", "htdemucs",
            "-d", "cpu",
            "-o", str(output_dir),
            input_file
        ]

        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )

        async def read_output():
            while True:
                line = await process.stderr.readline()
                if not line:
                    break
                
                line_text = line.decode().strip()
                logging.info(f"Demucs output: {line_text}")

                # Parse percentage from the output if it exists
                if '|' in line_text and '%' in line_text:
                    try:
                        # Extract percentage based on the known Demucs format
                        progress_part = line_text.split('|')[0]
                        percentage = float(progress_part.strip('%'))
                        logging.info(f"Processing progress: {percentage}%")
                        await status_handler.update_processing(percentage)
                    except ValueError:
                        logging.warning(f"Could not parse progress from line: {line_text}")

        # Start reading output and wait for the process to complete
        await asyncio.gather(read_output(), process.wait())

        if process.returncode == 0:
            input_name = Path(input_file).stem
            demucs_output = output_dir / "htdemucs" / input_name
            vocals_path = demucs_output / "vocals.wav"
            instrumental_path = demucs_output / "no_vocals.wav"

            logging.info(f"Looking for vocals at: {vocals_path}")
            logging.info(f"Looking for instrumental at: {instrumental_path}")

            if vocals_path.exists() and instrumental_path.exists():
                logging.info("Found both output files successfully")
                output_vocals = output_dir / "vocals.wav"
                output_instrumental = output_dir / "instrumental.wav"
                shutil.copy2(str(vocals_path), str(output_vocals))
                shutil.copy2(str(instrumental_path), str(output_instrumental))

                await status_handler.send_status("processing", 100, "Audio separation complete")
                return str(output_vocals), str(output_instrumental)
            else:
                logging.error("Output files not found after processing")
                raise FileNotFoundError("Output files not found after processing")
        else:
            raise RuntimeError(f"Demucs process failed with return code {process.returncode}")

    except Exception as e:
        error_msg = f"Error in audio processing: {str(e)}"
        logging.error(error_msg)
        await status_handler.send_error(error_msg)
        return None, None