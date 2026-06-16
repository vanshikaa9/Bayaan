
import requests
import json

from difflib import get_close_matches

import speech_recognition as sr
import sounddevice as sd
from scipy.io.wavfile import write

from languages import LANGUAGES

PROMPT_TEMPLATE = """
You are an e-commerce search query parser.

RULES

1. Extract shopping filters from the user's query.

2. Color mapping rules:
- If the query contains "laal", "lal", or "red", set color = "red".
- If the query contains "hara" or "green", set color = "green".
- If the query contains "kaala", "kala", or "black", set color = "black".
- If the query contains "neela", "nila", or "blue", set color = "blue".
- If the query contains "gulabi" or "pink", set color = "pink".
- If the query contains "safed" or "white", set color = "white".
- If the query contains "jacket", "jaket", or "coat", set category = "jacket".

Category mapping rules:

- "jean", "jeans", "denim" -> "jeans"
- "legging", "leggings" -> "leggings"
- "lehnga", "lehenga", "ghagra" -> "lehenga"
- "pajama", "pyjama", "night suit" -> "pajama"
- "dress", "gown", "frock" -> "dress"

Category extraction rules:

- If the query contains "kurti", "kurtti", or "kurtee", set category = "kurti".
- If the query contains "saadi", "sadi", "saaree", "saari", or "saree", set category = "saree".
- If the query contains "salwar", "salwar suit", "salwar kameez", or "suit", set category = "salwar suit".
- If the query contains "dupatta" or "chunni", set category = "dupatta".
- If the query contains "jeans" or "denim", set category = "jeans".
- If the query contains "leggings" or "legging", set category = "leggings".
- If the query contains "lehenga", "lehnga", or "ghagra", set category = "lehenga".
- If the query contains "dress", "gown", or "frock", set category = "dress".

3. Price extraction rules:
- "under", "below", "se kam", "ke andar" => max_price
- "above", "more than", "se zyada" => min_price

4. Unknown fields:
- Return null
- Never return empty strings
- Never omit fields

5. Return ONLY raw JSON.

Example:

Input:
laal jacket 500 se kam

Output:
{
  "category": "jacket",
  "color": "red",
  "max_price": 500,
  "min_price": null,
  "occasion": null,
  "gender": null
}

Input:
saadi laal 300 se kam

Output:
{
  "category": "saree",
  "color": "red",
  "max_price": 300,
  "min_price": null,
  "occasion": null,
  "gender": null
}

Input:
laal kurti 500 tak

Output:
{
  "category": "kurti",
  "color": "red",
  "max_price": 500,
  "min_price": null,
  "occasion": null,
  "gender": null
}

USER QUERY:
{query}
"""

def load_catalog():
    try:
        with open("catalog.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print("catalog.json not found")
        return []
    
def get_voice_query(language_code):
        fs = 44100
        seconds = 5

        print("Speak now...")

        recording = sd.rec(
            int(seconds * fs),
            samplerate=fs,
            channels=1,
            dtype="int16"
    )

        sd.wait()

        write("temp.wav", fs, recording)

        recognizer = sr.Recognizer()

        try:
            with sr.AudioFile("temp.wav") as source:
                audio = recognizer.record(source)

            text = recognizer.recognize_google(
                audio,
                #language="hi-IN"
                #language="en-IN"
                language=language_code
                
        )

            return text

        except Exception as e:
            print("Voice Error:", e)
            return None

def parse_query(query):
    prompt = PROMPT_TEMPLATE.replace("{query}", query)

    payload = {
        "model": "qwen2.5:3b",
        "stream": False,
        "options": {
            "temperature": 0
        },
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ]
    }
    try:
        response = requests.post(
            "http://localhost:11434/api/chat",
            json=payload,
            timeout=60
        )

        response.raise_for_status()

        model_output = response.json()["message"]["content"].strip()

        # Handle ```json ... ``` wrappers
        if model_output.startswith("```"):
            model_output = model_output.replace("```json", "")
            model_output = model_output.replace("```", "")
            model_output = model_output.strip()

        try:
            return json.loads(model_output)

        except json.JSONDecodeError:
            print("Invalid JSON returned by model:")
            print(model_output)

            return {
                "category": None,
                "color": None,
                "max_price": None,
                "min_price": None,
                "occasion": None,
                "gender": None
            }
    except requests.RequestException as e:
       print(f"Ollama API Error: {e}")

    return {
        "category": None,
        "color": None,
        "max_price": None,
        "min_price": None,
        "occasion": None,
        "gender": None
    }


catalog = load_catalog()

KNOWN_CATEGORIES = list(
    set(item["category"] for item in catalog)
)

def correct_category(category):

    if category is None:
        return None

    matches = get_close_matches(
        category.lower(),
        KNOWN_CATEGORIES,
        n=1,
        cutoff=0.4
    )

    if matches:
        return matches[0]

    return category


def search_catalog(filters):

    results = []

    for item in catalog:

        if (
           filters.get("category") is not None
            and item["category"].lower() !=filters["category"].lower()
        ):
            continue

        if (
            filters.get("color") is not None
            and item["color"].lower() !=filters["color"].lower()
        ):
            continue

        if (
           filters.get("max_price")is not None
            and item["price"] > filters["max_price"]
        ):
            continue

        if (
           filters.get("min_price")is not None
            and item["price"] < filters["min_price"]
        ):
            continue

        results.append(item)

    return results


def replan(filters):

    # Round 1
    # Relax color, keep category + price

    relaxed = filters.copy()
    relaxed["color"] = None

    results = search_catalog(relaxed)

    if results:
        return (
            results,
            CURRENT_LANGUAGE["messages"]["replan_color"]
           
        )

    # Round 2
    # Relax price, keep category

    relaxed = filters.copy()
    relaxed["max_price"] = None
    relaxed["min_price"] = None

    results = search_catalog(relaxed)
    if results:
        return (
            results,
            CURRENT_LANGUAGE["messages"]["replan_price"]
        )

    # Round 3
    # Relax category, keep color

    relaxed = filters.copy()
    relaxed["category"] = None
    relaxed["max_price"] = None
    relaxed["min_price"] = None

    results = search_catalog(relaxed)

    if results:
        return (
            results,
           CURRENT_LANGUAGE["messages"]["replan_category"]
        )

    # Round 4
    # Nothing found

    return (
    [],
    CURRENT_LANGUAGE["messages"]["replan_none"]
)

def has_filters(filters):
    return any(value is not None for value in filters.values())


# LANGUAGE SELECTION

print("Choose Language")
print("1 - Hindi")
print("2 - English")

choice = input("Choice: ")

CURRENT_LANGUAGE = LANGUAGES.get(
    choice,
    LANGUAGES["2"]
)

print(
    f"\nLanguage Selected: "
    f"{CURRENT_LANGUAGE['name']}\n"
)

#print(correct_category("jakct"))

# MAIN LOOP
while True:

    mode = input("Type or Voice? ").lower()

    if mode == "voice":

        query = get_voice_query(
    CURRENT_LANGUAGE["speech_code"]
)

        if query is None:
            continue

        print(f"\nRecognized: {query}")

    else:

        query = input("Search: ")

        if query.lower() == "exit":
            break

    filters = parse_query(query)

    if not has_filters(filters):
        print( CURRENT_LANGUAGE["messages"]["couldnt_understand"])
        continue

    original_category = filters.get("category")

    corrected_category = correct_category(original_category)

    if original_category != corrected_category:
        print(
            f"Corrected category: "
            f"{original_category} -> {corrected_category}"
        )

    filters["category"] = corrected_category

    print("\nExtracted Filters:")
    print(filters)

    results = search_catalog(filters)

    if not results:

        results, message = replan(filters)

        print("\n" + message)

    print("\nMatching Products:")

    if not results:
        print( CURRENT_LANGUAGE["messages"]["no_results"])

    else:
        for product in results:
            print(product)