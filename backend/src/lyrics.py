import requests
from bs4 import BeautifulSoup

def fetch_lyrics_from_genius(artist_name, song_title, genius_access_token):
    """
    Fetches song lyrics from Genius API and scrapes the lyrics page.

    Args:
        artist_name (str): Name of the artist.
        song_title (str): Title of the song.
        genius_access_token (str): Genius API access token.

    Returns:
        str: Extracted lyrics, or None if not found.
    """
    try:
        # Step 1: Search for the song using the Genius API
        search_url = "https://api.genius.com/search"
        headers = {"Authorization": f"Bearer {genius_access_token}"}
        params = {"q": f"{artist_name} {song_title}"}
        
        print(f"Searching Genius API for '{artist_name} - {song_title}'...")
        search_response = requests.get(search_url, headers=headers, params=params)
        search_response.raise_for_status()
        search_json = search_response.json()
        
        # Step 2: Parse the search response and get the first song hit
        hits = search_json.get("response", {}).get("hits", [])
        if not hits:
            print("No results found on Genius.")
            return None
        
        song_id = hits[0]["result"]["id"]
        print(f"Found song ID: {song_id}")
        
        # Step 3: Fetch the song's page URL
        song_url = f"https://api.genius.com/songs/{song_id}"
        song_response = requests.get(song_url, headers=headers)
        song_response.raise_for_status()
        song_json = song_response.json()
        
        page_url = song_json["response"]["song"]["url"]
        print(f"Lyrics page URL: {page_url}")
        # Step 4: Scrape lyrics from the Genius page using BeautifulSoup
        print("Fetching lyrics from the page...")
        response_html = requests.get(page_url)
        response_html.raise_for_status()
        soup = BeautifulSoup(response_html.text, "html.parser")

        # Look for all divs containing lyrics using the updated pattern
        lyrics_divs = soup.find_all("div", {"data-lyrics-container": "true"})

        # Extract lyrics text and clean up
        if not lyrics_divs:
            print("Could not find lyrics container on the page.")
            return None

        lyrics = "\n".join([div.get_text(separator="\n").strip() for div in lyrics_divs])
        return lyrics

    except Exception as e:
        print(f"An error occurred: {e}")
        return None

if __name__ == "__main__":
    # Input details
    artist_name = "Sabrina Carpenter"
    song_title = "Espresso"
    genius_access_token = "VxqQh3x7oTv02gz1jERWwtFjec7LaV2Iz6JSVbPyHyr_xxgy8WhbO1hBbxi9BvJ1"  # Replace with your Genius API token

    # Fetch and display lyrics
    lyrics = fetch_lyrics_from_genius(artist_name, song_title, genius_access_token)
    if lyrics:
        with open(f"lyrics.txt", "w", encoding="utf-8") as f:
            f.write(lyrics)
        print("Lyrics saved to file successfully!")
    else:
        print("Lyrics could not be fetched.")