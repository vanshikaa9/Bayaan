from bayaan import (
    parse_query,
    replan,
    recover_category,
    correct_category,
    normalize_query,
    has_filters
)
from providers.json_provider import JsonProvider
from languages import get_message

provider = JsonProvider()

def search_products(query, lang="en-IN"):
    try:
        catalog = provider.get_catalog()

        # Step 1: Normalize query using NLP layer (handles translation/transliteration)
        try:
            normalized = normalize_query(query)
        except Exception as e:
            print(f"Error normalizing query: {e}")
            normalized = query

        # Step 2: Parse query into structured filters
        try:
            filters = parse_query(normalized)
        except Exception as e:
            print(f"Error parsing query: {e}")
            filters = {
                "category": None,
                "color": None,
                "max_price": None,
                "min_price": None,
                "occasion": None,
                "gender": None
            }

        # Step 3: Run heuristics to recover category/correct spelling
        try:
            filters = recover_category(normalized, filters)
            filters["category"] = correct_category(
                filters.get("category")
            )
        except Exception as e:
            print(f"Error correcting category filters: {e}")

        # Step 4: Validate if we have any valid filters extracted
        if not has_filters(filters):
            return {
                "results": [],
                "filters": filters,
                "message": get_message(lang, "couldnt_understand")
            }

        # Step 5: Query search catalog through the provider
        try:
            results = provider.search_catalog(filters)
        except Exception as e:
            print(f"Error querying search catalog: {e}")
            results = []

        message = ""

        # Step 6: If no results found, perform a replan/relaxation search
        if not results:
            try:
                results, message = replan(
                    filters,
                    catalog,
                    search_fn=provider.search_catalog,
                    lang=lang
                )
            except Exception as e:
                print(f"Error during search replanning: {e}")
                results, message = [], get_message(lang, "replan_error")

        return {
            "results": results,
            "filters": filters,
            "message": message
        }

    except Exception as e:
        print(f"Unhandled error in search_products: {e}")
        return {
            "results": [],
            "filters": {},
            "message": get_message(lang, "search_error")
        }