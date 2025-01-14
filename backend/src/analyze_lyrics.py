import logging
from ollama import chat
from pydantic import BaseModel
from typing import List, Dict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Define Pydantic models for structured outputs
class Section(BaseModel):
    name: str
    lyrics: List[str]

class SongStructure(BaseModel):
    intro: List[Section] = []
    verses: List[Section]
    pre_choruses: List[Section] = []  # Added for transitions
    choruses: List[Section]
    post_choruses: List[Section] = []  # Added for reflections/emphasis
    bridge: List[Section] = []
    breakdown: List[Section] = []  # Added for stylistic or dynamic shifts
    outro: List[Section] = []

class RhymePair(BaseModel):
    word1: str
    line1: int
    word2: str
    line2: int
    phonetic_category_llm: str  # Phonetic category from the LLM
    phonetic_category_validated: str  # Phonetic category from external validation

class RhymeAnalysis(BaseModel):
    rhyming_pairs: List[RhymePair]
    rhyme_scheme: str

# Prompt Manager for centralized prompt handling
class PromptManager:
    def __init__(self):
        self.prompts = {
            "structure": (
                "Analyze the structure of these lyrics and return a JSON object. "
                "The JSON object should include the sections of the song: intro, verses, pre-choruses, choruses, post-choruses, bridge, breakdown, and outro. "
                "Clearly separate each section and list their lyrics as arrays. If sections repeat with slight variations, include each variation under the same section name with an identifier (e.g., 'Chorus (1)', 'Chorus (2)'). "
                "Ensure sections like Pre-Chorus and Post-Chorus are distinguished from the main Chorus. For instance, Pre-Choruses often transition into the Chorus, while Post-Choruses reflect or emphasize the Chorus theme."
            ),
           "rhymes": (
                "Analyze the rhyming patterns in these lyrics and return a JSON object. "
                    "The JSON object should include: "
                    "1. A list of rhyming pairs, where each pair contains the rhyming words, their respective line numbers, and the phonetic similarity of the rhyme. "
                    "2. The overall rhyme scheme for the song (e.g., AABB, ABAB, or freeform). "
                    "3. Use standard phonetic categories for rhymes, such as 'long i' (e.g., 'light' and 'tonight') or 'short e' (e.g., 'met' and 'set'). "
                    "Return only the JSON object with no additional text."
            ),
        }

    def get_prompt(self, key: str) -> str:
        prompt = self.prompts.get(key)
        if not prompt:
            raise ValueError(f"No prompt found for key: {key}")
        return prompt

PROMPT_MANAGER = PromptManager()

# Modular LLM Query Function
def query_llm(
    model_schema: BaseModel,
    lyrics: str,
    prompt_key: str,
    model: str = "llama3.2",
    format_enforcement: bool = True,
) -> Dict:
    """
    Query the LLM API with structured output enforcement using a schema.
    """
    try:
        prompt = PROMPT_MANAGER.get_prompt(prompt_key)

        response = chat(
            messages=[
                {"role": "user", "content": f"{prompt}\n\n{lyrics}"}
            ],
            model=model,
            format=model_schema.model_json_schema() if format_enforcement else None,
        )

        # Validate and parse response using Pydantic
        structured_response = model_schema.model_validate_json(response.message.content)
        logger.info("LLM response successfully validated.")

        # Skip intro/outro validation for RhymeAnalysis
        if model_schema != RhymeAnalysis:
            # Check for missing or empty sections
            if not structured_response.intro:
                logger.warning("Intro section is empty. Verify if intro lyrics exist.")
            if not structured_response.outro:
                logger.warning("Outro section is empty. Verify if outro lyrics exist.")

        return structured_response
    except Exception as e:
        logger.error(f"LLM query failed for prompt '{prompt_key}': {e}")
        raise ValueError(f"Failed to query LLM: {e}")

# Analysis Functions
def analyze_structure(lyrics: str) -> Dict:
    """
    Analyze the structure of the song using the LLM with structured outputs.

    Workflow:
    - Uses the "structure" prompt from PromptManager.
    - Sends lyrics and prompt to the LLM through query_llm.
    - Ensures the output adheres to the SongStructure schema.

    Args:
        lyrics (str): The song lyrics to analyze.

    Returns:
        Dict: A structured representation of the song's sections.
    """
    return query_llm(
        model_schema=SongStructure,
        lyrics=lyrics,
        prompt_key="structure",
        model="llama3.2",
    )

def analyze_rhymes(lyrics: str) -> Dict:
    """
    Analyze rhyming patterns in the lyrics using the LLM with structured outputs.

    Workflow:
    - Uses the "rhymes" prompt from PromptManager.
    - Sends lyrics and prompt to the LLM through query_llm.
    - Ensures the output adheres to the RhymeAnalysis schema.

    Args:
        lyrics (str): The song lyrics to analyze.

    Returns:
        Dict: A structured representation of the rhyming patterns.
    """
    return query_llm(
        model_schema=RhymeAnalysis,
        lyrics=lyrics,
        prompt_key="rhymes",
        model="llama3.2",
    )