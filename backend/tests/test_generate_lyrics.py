import os
from pathlib import Path
import requests
import json
from typing import Dict
from enum import Enum
from analyze_lyrics import analyze_structure

class SongTheme(Enum):
    NATURE = "a song about the beauty of nature"
    TECH_RIVALRY = "a song about iPhone versus Samsung rivalry"
    CAPITALISM = "a song about US capitalism, GDP, and finance"
    CHRISTMAS = "a winter Christmas ballad"
    FOOD = "a song about favorite foods and cooking"
    SPORTS = "a song about sports rivalries and competition"

def generate_remix(original_lyrics: str, analysis: Dict, theme: SongTheme) -> str:
    """Generate remix using llama3.2"""
    url = os.getenv('OLLAMA_HOST', 'http://localhost:11434') + '/api/generate'
    
    prompt = f'''Transform these lyrics while maintaining the exact same structure.

NEW THEME: {theme.value}

STRUCTURAL REQUIREMENTS:
{json.dumps(analysis, indent=2)}

Original lyrics for reference:
{original_lyrics}

Generate new lyrics following the exact same structure. Include all section markers (Intro, Verse 1, etc.).
Output only the new lyrics, no explanations.'''
    
    try:
        response = requests.post(url, json={
            "model": "llama3.2",
            "prompt": prompt,
            "temperature": 0.8,
            "top_p": 0.9,
            "stream": False
        })
        response.raise_for_status()
        return response.json()["response"]
    except Exception as e:
        print(f"Remix generation failed: {e}")
        raise

def main():
    input_file = Path(os.getenv('LYRICS_DIR', './lyrics')) / 'input.txt'
    try:
        print(f"\nReading lyrics from: {input_file}")
        
        with open(input_file, 'r') as file:
            original_lyrics = file.read()
            
        print("\nAnalyzing song structure...")
        analysis = analyze_structure(original_lyrics)
        
        print("\nStructure Analysis:")
        print(json.dumps(analysis, indent=2))
        
        # Test with a specific theme
        theme = SongTheme.CHRISTMAS  # Change this to test different themes
        print(f"\nGenerating {theme.name} version...")
        remixed_lyrics = generate_remix(
            original_lyrics=original_lyrics,
            analysis=analysis,
            theme=theme
        )
        
        # Save the output
        output_file = Path(os.getenv('LYRICS_DIR', './lyrics')) / f'output_{theme.name.lower()}.txt'
        with open(output_file, 'w') as file:
            file.write(remixed_lyrics)
        print(f"\nSaved {theme.name} version to {output_file}")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        raise

if __name__ == "__main__":
    main()