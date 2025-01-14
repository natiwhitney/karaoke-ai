import os
from pathlib import Path
import requests
import json
import logging
from typing import Dict
from dotenv import load_dotenv

# Add at the top of your file, after imports
import re
from datetime import datetime

# Configure logging
log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
logging.basicConfig(
    level=logging.DEBUG,
    format=log_format,
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(f'analysis_log_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
    ]
)

logger = logging.getLogger(__name__)

# Add debug flag
DEBUG = True

if not DEBUG:
    logging.getLogger().setLevel(logging.INFO)


# Load environment variables
env_path = Path(__file__).parents[2] / '.env'
load_dotenv(env_path)

VERSION = "0.2"

ANALYSIS_PROMPT = '''Analyze this song's structure. Return ONLY valid JSON with no comments.
Required sections must include:
- intro
- verse
- chorus
- operatic (for any operatic sections)
- bridge
- outro

For each section include:
- All lyrics in that section
- Exact syllable count for each line
- Musical style (ballad/rock/operatic)
- Tempo and dynamics
- Transition type to next section

Do not include:
- Comments
- Explanatory text
- Empty sections

{original_lyrics}'''


def _clean_json_string(json_str: str) -> str:
    """Clean and validate JSON string before parsing"""
    logger.info("Starting JSON cleaning process...")
    
    def log_chunk(chunk: str, prefix: str = ""):
        """Helper to log chunks of text with line numbers"""
        lines = chunk.split('\n')
        for i, line in enumerate(lines, 1):
            logger.debug(f"{prefix}Line {i}: {line}")

    # Log the input
    logger.debug("Original JSON string:")
    log_chunk(json_str)
    
    try:
        # Basic cleaning
        cleaned = json_str.strip()
        
        # Remove any trailing commas before closing brackets
        cleaned = re.sub(r',(\s*})', r'\1', cleaned)
        cleaned = re.sub(r',(\s*])', r'\1', cleaned)
        
        # Ensure proper array/object closing
        brace_count = 0
        bracket_count = 0
        char_list = list(cleaned)
        
        logger.info("Checking JSON structure...")
        for i, char in enumerate(char_list):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
            elif char == '[':
                bracket_count += 1
            elif char == ']':
                bracket_count -= 1
                
            if brace_count < 0 or bracket_count < 0:
                context = cleaned[max(0, i-50):min(len(cleaned), i+50)]
                logger.error(f"Mismatched brackets near: ...{context}...")
        
        if brace_count != 0 or bracket_count != 0:
            logger.error(f"Unbalanced structure: braces={brace_count}, brackets={bracket_count}")
            
        # Log the cleaned result
        logger.debug("Cleaned JSON string:")
        log_chunk(cleaned)
        
        # Verify it's valid JSON
        json.loads(cleaned)  # Test parse
        
        return cleaned
        
    except Exception as e:
        logger.error(f"Error during JSON cleaning: {str(e)}")
        logger.error("Problem area context:")
        if hasattr(e, 'pos'):
            pos = e.pos
            context = cleaned[max(0, pos-100):min(len(cleaned), pos+100)]
            logger.error(f"...{context}...")
        raise

def _extract_json_from_response(raw_response: str) -> Dict:
    """Extract and validate JSON from LLM response with enhanced logging"""
    logger.info("Starting JSON extraction from response...")
    
    try:
        # Log response details
        logger.info(f"Response length: {len(raw_response)}")
        logger.debug("Response preview:")
        logger.debug(raw_response[:500] + "..." if len(raw_response) > 500 else raw_response)
        
        # Find JSON boundaries
        json_start = raw_response.find('{')
        json_end = raw_response.rfind('}') + 1
        
        if json_start == -1 or json_end <= 0:
            logger.error("No valid JSON delimiters found")
            logger.error("Raw response:")
            logger.error(raw_response)
            raise ValueError("No JSON object found in response")
        
        # Extract JSON string
        json_str = raw_response[json_start:json_end]
        logger.info(f"Extracted JSON string from position {json_start} to {json_end}")
        
        # Clean and parse JSON
        cleaned_json = _clean_json_string(json_str)
        
        logger.info("Parsing cleaned JSON...")
        analysis = json.loads(cleaned_json)
        
        # Validate structure
        logger.info("Validating analysis structure...")
        _validate_analysis_structure(analysis)
        
        return analysis
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}")
        logger.error(f"Error at line {e.lineno}, column {e.colno}")
        logger.error(f"Error message: {e.msg}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during JSON extraction: {str(e)}")
        raise

def analyze_structure(lyrics: str, song_metadata: Dict = None) -> Dict:
    """Analyze song structure using LLM with enhanced logging"""
    logger.info("Starting song structure analysis...")
    logger.info(f"Input lyrics length: {len(lyrics)} characters")
    
    url = os.getenv('OLLAMA_HOST', 'http://localhost:11434') + '/api/generate'
    
    try:
        # Format prompt
        prompt = ANALYSIS_PROMPT.format(version=VERSION, original_lyrics=lyrics)
        logger.info("Sending request to LLM...")
        logger.debug("Prompt preview:")
        logger.debug(prompt[:500] + "..." if len(prompt) > 500 else prompt)
        
        # Make request
        response = requests.post(url, json={
            "model": "llama3.2",
            "prompt": prompt,
            "temperature": 0.1,
            "top_p": 0.1,
            "stream": False
        })
        
        response.raise_for_status()
        logger.info("Received response from LLM")
        
        # Extract and process JSON
        raw_response = response.json().get("response", "")
        initial_analysis = _extract_json_from_response(raw_response)
        
        logger.info("Initial analysis complete, starting refinement...")
        
        # Validation and refinement
        validation_prompt = _create_validation_prompt(initial_analysis, {
            "lyrics": lyrics,
            "metadata": song_metadata or {}
        })
        
        logger.info("Sending refinement request...")
        refined_analysis = _refine_analysis(validation_prompt, url)
        
        # Ensure version
        refined_analysis["version"] = VERSION
        
        logger.info("Analysis complete")
        return refined_analysis
        
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        raise

def _validate_analysis_structure(analysis: Dict) -> None:
    """Validate the analysis has all required fields and proper structure"""
    required_fields = {
        "sections": list,
        "overall_structure": dict
    }
    
    for field, field_type in required_fields.items():
        if field not in analysis:
            raise ValueError(f"Missing required field: {field}")
        if not isinstance(analysis[field], field_type):
            raise ValueError(f"Invalid type for {field}: expected {field_type}")
            
    # Validate each section has required fields
    for section in analysis["sections"]:
        _validate_section_structure(section)

def _validate_section_structure(section: Dict) -> None:
    """Validate individual section structure"""
    required_fields = {
        "type": dict,
        "musical_characteristics": dict,
        "lines": list,
        "transition": dict
    }
    
    for field, field_type in required_fields.items():
        if field not in section:
            raise ValueError(f"Missing required section field: {field}")
        if not isinstance(section[field], field_type):
            raise ValueError(f"Invalid type for section {field}: expected {field_type}")

def _create_validation_prompt(initial_analysis: Dict, context: Dict) -> str:
    """Create a prompt to validate and refine the analysis"""
    return f'''Review this song structure analysis for accuracy and completeness:

{json.dumps(initial_analysis, indent=2)}

Verify:
1. Section transitions are properly identified
2. Style changes are accurately marked
3. Musical characteristics are consistent
4. Pattern analysis is complete

Return the corrected analysis maintaining the exact same JSON structure.'''

def _refine_analysis(validation_prompt: str, url: str) -> Dict:
    """Refine the analysis based on validation results"""
    try:
        response = requests.post(url, json={
            "model": "llama3.2",
            "prompt": validation_prompt,
            "temperature": 0.1,
            "stream": False
        })
        response.raise_for_status()
        
        return _extract_json_from_response(response.json().get("response", ""))
        
    except Exception as e:
        logger.error(f"Refinement failed: {e}")
        raise

def validate_section(section):
    """Validate each section has required fields"""
    required = {
        'type': str,
        'musical_characteristics': dict,
        'lines': list,
        'transition': dict
    }
    
    for field, field_type in required.items():
        if not isinstance(section.get(field), field_type):
            raise ValueError(f"Section missing or invalid {field}")
            
    # Validate all lines have syllables counted
    for line in section['lines']:
        if line['syllable_count'] == 0:
            raise ValueError("Syllables not counted")

@router.get("/api/song/{song_id}/summary")
async def get_song_summary(song_id: str):
    """Get a high-level song analysis summary"""
    analysis = await analyze_structure(song_id)
    
    return {
        "title": song_id,
        "sections": [s["type"]["primary"] for s in analysis["sections"]],
        "key_changes": analysis["overall_structure"]["key_changes"],
        "style_changes": analysis["overall_structure"]["style_changes"],
        "total_sections": len(analysis["sections"])
    }

def main():
    input_file = Path(os.getenv('LYRICS_DIR', './lyrics')) / 'input.txt'
    try:
        logger.info(f"Reading lyrics from: {input_file}")
        
        with open(input_file, 'r') as file:
            original_lyrics = file.read()
        
        # Optionally load any existing metadata
        metadata_file = input_file.parent / 'metadata.json'
        song_metadata = None
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                song_metadata = json.load(f)
        
        logger.info(f"Starting song analysis (v{VERSION})...")
        analysis = analyze_structure(original_lyrics, song_metadata)
        
        # Save the analysis output
        output_file = Path(os.getenv('LYRICS_DIR', './lyrics')) / 'analysis_output.json'
        with open(output_file, 'w') as file:
            json.dump(analysis, file, indent=2)
            
        logger.info(f"Analysis (v{VERSION}) saved to {output_file}")
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise

if __name__ == "__main__":
    main()