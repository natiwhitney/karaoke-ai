import json
import os
from pathlib import Path
import logging
import requests
from openai import OpenAI
from dotenv import load_dotenv

env_path = Path(__file__).parents[2] / '.env'
load_dotenv(env_path)

use_openai = os.getenv('USE_OPENAI', 'false').lower() == 'true'
print(f"USE_OPENAI: {use_openai}")

def transform_lyrics(original_lyrics, style_description="A song about US capitalism", custom_prompt=None, model="llama3.2"):    
    # Construct prompt based on custom input
    if custom_prompt:
        prompt = f"""{custom_prompt}

Style description: {style_description}

Original lyrics:
{original_lyrics}

Output only the remixed lyrics, no commentary."""
    else:
        prompt = f"""You're remixing this song. Keep core patterns and motifs, but transform them into {style_description}.
            Key remix rules:
            - Preserve rhyme schemes and rhythmic structure 
            - Reference recognizable phrases/themes from original, but recontextualize them
            - Match syllable counts per line where possible
            - Keep hooks/choruses recognizable but rewritten

            Original lyrics:
            {original_lyrics}

            Output only the remixed lyrics, no commentary."""

    print(f"Model: {'OpenAI' if use_openai else model}")
    print(f"Prompt:\n{prompt}")

    try:
        logging.info(f"Using {'OpenAI' if use_openai else 'Ollama'} API for lyrics transformation.")
        if use_openai:
            print("Using OpenAI API for lyrics transformation.")
            return _transform_openai(prompt)
        else:
            print("Using Ollama API for lyrics transformation.")
        return _transform_ollama(prompt, model)

    except Exception as e:
        logging.error(f"Error during lyrics transformation: {e}")
        return None

def _transform_openai(prompt: str) -> str:
    print("OpenAI API request...")
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    model = os.getenv('OPENAI_MODEL', 'gpt-4')
    messages = [
        {"role": "system", "content": "You are a creative lyricist who transforms songs."},
        {"role": "user", "content": prompt}
    ]
    
    response = client.chat.completions.create(
        model=model,
        messages=messages
    )
        
    remixed_lyrics = response.choices[0].message.content
    _save_lyrics(remixed_lyrics)
    return remixed_lyrics

def _transform_ollama(prompt: str, model: str) -> str:
    url = os.getenv('OLLAMA_HOST', 'http://localhost:11434') + '/api/generate'

    print(f"Local Request - Model: {model}")
    response = requests.post(url, json={
        "model": model,
        "prompt": prompt,
        "stream": False
    })
    response.raise_for_status()
    remixed_lyrics = response.json().get("response", "")
    _save_lyrics(remixed_lyrics)
    return remixed_lyrics

def _save_lyrics(remixed_lyrics: str) -> None:
    output_dir = Path(os.getenv('LYRICS_DIR', './lyrics'))
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / 'remixed_lyrics.txt'
    with open(output_file, 'w') as file:
        file.write(remixed_lyrics)
    print(f"Remixed lyrics saved successfully to {output_file}!")

if __name__ == "__main__":
    input_file = Path(os.getenv('LYRICS_DIR', './lyrics')) / 'original.txt'
    try:
        with open(input_file, 'r') as file:
            transform_lyrics(file.read())
    except FileNotFoundError:
        print(f"Error: Could not find lyrics file at {input_file}")
    except Exception as e:
        print(f"Error: {e}")