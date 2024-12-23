import requests
import json
import os
from pathlib import Path
import logging

def transform_lyrics(original_lyrics, style_description="A song about US capitalism", custom_prompt=None, model="llama3.1"):
    """
    Transform lyrics into a different style using Ollama API.
    
    Args:
        original_lyrics (str): The original lyrics to transform.
        style_description (str): High-level style description.
        custom_prompt (str): User-modified prompt; optional.
        model (str): The Ollama model to use.
        
    Returns:
        str: The transformed lyrics, or None if an error occurs.
    """
    # If user provided a custom prompt, merge it with style description
    if custom_prompt:
        prompt = f"""{custom_prompt}

Style description: {style_description}

Original lyrics:
{original_lyrics}

Output only the remixed lyrics, no commentary."""
    else:
        # Default behavior: use the system-defined template
        prompt = f"""You're remixing this song. Keep core patterns and motifs, but transform them into {style_description}.
Key remix rules:
- Preserve rhyme schemes and rhythmic structure 
- Reference recognizable phrases/themes from original, but recontextualize them
- Match syllable counts per line where possible
- Keep hooks/choruses recognizable but rewritten

Original lyrics:
{original_lyrics}

Output only the remixed lyrics, no commentary."""

    # Log the complete query before sending
    logging.info("Sending query to LLM:")
    logging.info(f"Model: {model}")
    logging.info(f"Prompt:\n{prompt}")

    # Ollama API endpoint and payload
    url = os.getenv('OLLAMA_HOST', 'http://localhost:11434') + '/api/generate'
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }

    try:
        # Send the request to the Ollama API
        response = requests.post(url, json=payload, stream=False)
        response.raise_for_status()

        # Parse the JSON response
        json_data = response.json()
        remixed_lyrics = json_data.get("response", "")

        # Save the remixed lyrics to a file
        output_dir = Path(os.getenv('LYRICS_DIR', './lyrics'))
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / 'remixed_lyrics.txt'
        with open(output_file, 'w') as file:
            file.write(remixed_lyrics)

        print(f"Remixed lyrics saved successfully to {output_file}!")
        return remixed_lyrics

    except Exception as e:
        logging.error(f"Error during lyrics transformation: {e}")
        return None


if __name__ == "__main__":
    # This code only runs if the script is executed directly
    input_file = Path(os.getenv('LYRICS_DIR', './lyrics')) / 'original.txt'
    
    try:
        with open(input_file, 'r') as file:
            original_lyrics = file.read()
        
        transform_lyrics(original_lyrics)
    except FileNotFoundError:
        print(f"Error: Could not find lyrics file at {input_file}")
    except Exception as e:
        print(f"Error: {e}")