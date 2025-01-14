import asyncio
import os
from pathlib import Path
import logging
import sys

# Add src directory to Python path
sys.path.append(str(Path(__file__).parent / "src"))

from advanced_demucs import (
    process_audio_advanced,
    StemConfig,
    DemucsModel,
    ProcessingDevice,
    StatusHandler
)

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TestStatusHandler(StatusHandler):
    async def send_status(self, stage: str, progress: float, message: str = None):
        logger.info(f"Status: {stage} - {progress}% - {message}")
        
    async def update_processing(self, progress: float):
        logger.info(f"Progress: {progress}%")
        
    async def send_error(self, error_message: str):
        logger.error(f"Error: {error_message}")

async def main():
    # Get the current directory (test directory)
    base_dir = Path(__file__).parent
    input_file = base_dir / "original.mp3"
    
    if not input_file.exists():
        raise FileNotFoundError(
            f"Input file not found: {input_file}\n"
            "Please place an original.mp3 file in the test directory."
        )

    # Create output directory
    output_base = base_dir / "output"
    output_base.mkdir(parents=True, exist_ok=True)

    # Initialize status handler
    status_handler = TestStatusHandler()

    # Test configurations
    test_configs = [
        (StemConfig.VOCALS_ONLY, "vocals_only"),
        (StemConfig.FOUR_STEMS, "four_stems"),
    ]

    for config, folder_name in test_configs:
        logger.info(f"\nProcessing with configuration: {config.name}")
        
        # Create specific output directory for this configuration
        output_dir = output_base / folder_name
        output_dir.mkdir(exist_ok=True)
        
        try:
            # Process audio with current configuration
            stem_paths = await process_audio_advanced(
                input_file=str(input_file),
                output_dir=str(output_dir),
                config=config,
                model=DemucsModel.HTDEMUCS,
                device=ProcessingDevice.CPU,
                status_handler=status_handler
            )
            
            # Log results
            logger.info(f"\nProcessing complete for {config.name}")
            logger.info("Generated stems:")
            for stem_name, stem_path in stem_paths.items():
                logger.info(f"- {stem_name}: {stem_path}")
                
        except Exception as e:
            logger.error(f"Error processing {config.name}: {e}")
            continue

if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())