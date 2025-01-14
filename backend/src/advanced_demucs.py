import subprocess
import os
import sys
from pathlib import Path
import logging
import asyncio
import shutil
from typing import List, Dict, Optional
from enum import Enum

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StemConfig(Enum):
    VOCALS_ONLY = "vocals"  # Vocals vs everything else
    FOUR_STEMS = "4stems"   # Vocals, drums, bass, other
    SIX_STEMS = "6stems"    # Vocals, drums, bass, guitar, piano, other
    KARAOKE = "karaoke"     # Enhanced vocal separation for karaoke

class DemucsModel(Enum):
    HTDEMUCS = "htdemucs"           # High quality, slower
    HTDEMUCS_FT = "htdemucs_ft"     # Fine-tuned model
    MDXNET = "mdx"                  # Faster, lower quality
    MDXNET_EXTRA = "mdx_extra"      # Extra stem separation

class ProcessingDevice(Enum):
    CPU = "cpu"
    CUDA = "cuda"
    MPS = "mps"  # For Apple Silicon

async def process_audio_advanced(
    input_file: str,
    output_dir: str,
    config: StemConfig,
    model: DemucsModel = DemucsModel.HTDEMUCS,
    device: ProcessingDevice = ProcessingDevice.CPU,
    status_handler = None
) -> Dict[str, str]:
    """
    Process audio file with advanced Demucs configurations.
    
    Args:
        input_file: Path to input audio file
        output_dir: Directory to save processed stems
        config: StemConfig enum specifying separation type
        model: DemucsModel enum specifying which model to use
        device: ProcessingDevice enum for processing hardware
        status_handler: Optional status handler for progress updates
    
    Returns:
        Dictionary mapping stem names to their file paths
    """
    try:
        logger.info(f"Starting advanced Demucs separation for {input_file}")
        if status_handler:
            await status_handler.send_status("processing", 0, "Initializing audio separation...")

        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Build Demucs command based on configuration
        command = ["demucs"]
        
        # Add model selection
        command.extend(["-n", model.value])
        
        # Add device selection
        command.extend(["-d", device.value])
        
        # Configure stems based on selected config
        if config == StemConfig.VOCALS_ONLY:
            command.append("--two-stems=vocals")
        elif config == StemConfig.FOUR_STEMS:
            # Default Demucs behavior, no extra args needed
            pass
        elif config == StemConfig.SIX_STEMS:
            command.append("--six-stems")
        elif config == StemConfig.KARAOKE:
            command.extend(["--two-stems=vocals", "--vocals-only"])
        
        # Add remaining arguments
        command.extend([
            "-o", str(output_dir),
            input_file
        ])

        # Set up environment for unbuffered output
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"

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
                logger.info(f"Demucs output: {line_text}")

                if status_handler and '|' in line_text and '%' in line_text:
                    try:
                        progress_part = line_text.split('|')[0]
                        percentage = float(progress_part.strip('%'))
                        await status_handler.update_processing(percentage)
                    except ValueError:
                        logger.warning(f"Could not parse progress from line: {line_text}")

        await asyncio.gather(read_output(), process.wait())

        if process.returncode == 0:
            # Handle different stem configurations
            input_name = Path(input_file).stem
            demucs_output = output_dir / model.value / input_name
            
            stem_paths = {}
            expected_stems = _get_expected_stems(config)
            
            # Copy and rename stems to standardized output
            for stem in expected_stems:
                source_path = demucs_output / f"{stem}.wav"
                if source_path.exists():
                    target_path = output_dir / f"{stem}.wav"
                    shutil.copy2(str(source_path), str(target_path))
                    stem_paths[stem] = str(target_path)
                else:
                    logger.warning(f"Expected stem {stem} not found")

            if status_handler:
                await status_handler.send_status("processing", 100, "Audio separation complete")
                
            return stem_paths
        else:
            raise RuntimeError(f"Demucs process failed with return code {process.returncode}")

    except Exception as e:
        error_msg = f"Error in audio processing: {str(e)}"
        logger.error(error_msg)
        if status_handler:
            await status_handler.send_error(error_msg)
        return {}

def _get_expected_stems(config: StemConfig) -> List[str]:
    """Get list of expected stem names based on configuration"""
    if config == StemConfig.VOCALS_ONLY:
        return ["vocals", "no_vocals"]
    elif config == StemConfig.FOUR_STEMS:
        return ["vocals", "drums", "bass", "other"]
    elif config == StemConfig.SIX_STEMS:
        return ["vocals", "drums", "bass", "guitar", "piano", "other"]
    elif config == StemConfig.KARAOKE:
        return ["vocals", "no_vocals"]
    return []

# Example status handler class for reference
class StatusHandler:
    async def send_status(self, stage: str, progress: float, message: str = None):
        """Send status update"""
        pass
        
    async def update_processing(self, progress: float):
        """Update processing progress"""
        pass
        
    async def send_error(self, error_message: str):
        """Send error message"""
        pass