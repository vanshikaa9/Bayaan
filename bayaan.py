
import requests
import json
import os
from dotenv import load_dotenv

from difflib import get_close_matches

from languages import get_replan_messages, DEFAULT_SPEECH_CODE


# Load environment variables
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


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

IMPORTANT:

If a category word appears anywhere in the query,
you MUST populate category.

Examples:

"red saree"
→ category = "saree"

"green kurti"
→ category = "kurti"

"black jeans"
→ category = "jeans"

Never return category = null when a known category is present.

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

CATEGORY_ALIASES = {
    "saree": "saree",
    "sari": "saree",
    "saari": "saree",
    "saadi": "saree",
    "sadi": "saree",

    "kurti": "kurti",
    "kurtti": "kurti",
    "kurtee": "kurti",
    "kurta": "kurti",

    "salwar": "salwar suit",
    "suit": "salwar suit",

    "dupatta": "dupatta",
    "chunni": "dupatta",

    "jeans": "jeans",
    "jean": "jeans",
    "denim": "jeans",

    "leggings": "leggings",
    "legging": "leggings",

    "lehenga": "lehenga",
    "lehnga": "lehenga",
    "ghagra": "lehenga",

    "dress": "dress",
    "gown": "dress",
    "frock": "dress",

    "jacket": "jacket",
    "jaket": "jacket",
    "coat": "jacket",

    "pajama": "pajama",
    "pyjama": "pajama",
    "night suit": "pajama"
}

COLOR_ALIASES = {
    "laal": "red",
    "lal": "red",
    "red": "red",

    "hara": "green",
    "green": "green",

    "kaala": "black",
    "kala": "black",
    "black": "black",

    "neela": "blue",
    "nila": "blue",
    "blue": "blue",

    "gulabi": "pink",
    "pink": "pink",

    "safed": "white",
    "white": "white"
}

def fallback_parse_query(query):
    """
    Fallback parser that extracts filters from the query using rule-based/regex logic
    if the Groq API call fails or is not configured.
    """
    import re
    query_lower = query.lower()
    
    filters = {
        "category": None,
        "color": None,
        "max_price": None,
        "min_price": None,
        "occasion": None,
        "gender": None
    }
    
    # Extract Color
    for keyword, color_val in COLOR_ALIASES.items():
        if re.search(r'\b' + re.escape(keyword) + r'\b', query_lower):
            filters["color"] = color_val
            break

    # Extract Category
    for keyword, cat_val in CATEGORY_ALIASES.items():
        if re.search(r'\b' + re.escape(keyword) + r'\b', query_lower):
            filters["category"] = cat_val
            break
            
    # Extract Price
    price_matches = re.findall(r'\b\d+\b', query_lower)
    if price_matches:
        price_num = int(price_matches[0])
        max_price_keywords = ["under", "below", "kam", "andar", "tak", "less", "within", "max", "se kam", "ke andar"]
        min_price_keywords = ["above", "more", "zyada", "greater", "min", "se zyada", "se jyada"]
        
        is_min = any(keyword in query_lower for keyword in min_price_keywords)
        
        if is_min:
            filters["min_price"] = price_num
        else:
            filters["max_price"] = price_num

    # Extract Occasion
    occasions = ["wedding", "party", "casual", "daily wear", "sleepwear"]
    for occ in occasions:
        if occ in query_lower:
            filters["occasion"] = occ
            break
            
    if "women" in query_lower or "girl" in query_lower or "female" in query_lower:
        filters["gender"] = "women"
    elif "men" in query_lower or "boy" in query_lower or "male" in query_lower:
        filters["gender"] = "men"

    print(f"Fallback parser executed. Extracted: {filters}")
    return filters

def normalize_query(query):
    if not GROQ_API_KEY:
        print("Warning: GROQ_API_KEY is not configured. Skipping normalization.")
        return query

    prompt = f"""
You are a multilingual e-commerce assistant.

The user may speak in Hindi, Tamil,
Telugu, Bengali, Hinglish, or English.

Convert the shopping query into
standard English shopping terms.

Examples:

சிவப்பு சேலை -> red saree
பச்சை சேலை -> green saree

লাল শাড়ি -> red saree
সবুজ শাড়ি -> green saree

লাল শাড়ি -> red saree
हरा दुपट्टा -> green dupatta

Return ONLY the normalized query. Do not add any explanation or preamble.

Query:
{query}
"""

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "stream": False
    }

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=15
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"].strip()
        if content.startswith('"') and content.endswith('"'):
            content = content[1:-1].strip()
        return content
    except Exception as e:
        print(f"Groq Normalization API Error: {e}. Falling back to original query.")
        return query       

def parse_query(query):
    if not GROQ_API_KEY:
        print("Warning: GROQ_API_KEY is not configured. Using fallback parser.")
        return fallback_parse_query(query)

    prompt = PROMPT_TEMPLATE.replace("{query}", query)

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "stream": False,
        "response_format": {"type": "json_object"}
    }
    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=15
        )
        response.raise_for_status()
        model_output = response.json()["choices"][0]["message"]["content"].strip()
       
        if model_output.startswith("```"):
            model_output = model_output.replace("```json", "")
            model_output = model_output.replace("```", "")
            model_output = model_output.strip()

        try:
            filters = json.loads(model_output)
            for key, value in filters.items():
                if value == "null" or value == "None":
                    filters[key] = None
            return filters
        except json.JSONDecodeError:
            print("Invalid JSON returned by Groq model:")
            print(model_output)
            return fallback_parse_query(query)
        
    except Exception as e:
        print(f"Groq Query Parsing API Error: {e}. Using fallback parser.")
        return fallback_parse_query(query)

catalog = load_catalog()

KNOWN_CATEGORIES = list(
    set(item["category"] for item in catalog)
)

def recover_category(query, filters):

    if filters["category"] is not None:
        return filters

    q = query.lower()

    for keyword, category in CATEGORY_ALIASES.items():

        if keyword in q:

            filters["category"] = category
            break

    return filters

def correct_category(category, catalog=None):

    if category is None:
        return None

    known = (
        list(set(item["category"] for item in catalog))
        if catalog
        else KNOWN_CATEGORIES
    )

    matches = get_close_matches(
        category.lower(),
        known,
        n=1,
        cutoff=0.4
    )

    if matches:
        return matches[0]

    return category


def replan(filters, catalog, *, search_fn, lang=None):
    msgs = get_replan_messages(lang or DEFAULT_SPEECH_CODE)

    relaxed = filters.copy()
    relaxed["color"] = None
    results = search_fn(relaxed)
    if results:
        return results, msgs["replan_color"]

    relaxed = filters.copy()
    relaxed["max_price"] = None
    relaxed["min_price"] = None
    results = search_fn(relaxed)
    if results:
        return results, msgs["replan_price"]

    relaxed = filters.copy()
    relaxed["category"] = None
    relaxed["max_price"] = None
    relaxed["min_price"] = None
    results = search_fn(relaxed)
    if results:
        return results, msgs["replan_category"]

    return [], msgs["replan_none"]

     

def has_filters(filters):
    return any(value is not None for value in filters.values())

