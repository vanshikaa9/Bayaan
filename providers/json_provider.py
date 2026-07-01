import json
import os

class JsonProvider:
    def __init__(self, filepath="catalog.json"):
        self.filepath = filepath
        self._catalog = self._load_catalog()

    def _load_catalog(self):
        try:
            path = self.filepath
            if not os.path.isabs(path):
                # Resolve relative to the application workspace directory (parent of providers folder)
                base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                path = os.path.join(base_dir, self.filepath)
            
            if not os.path.exists(path):
                # Fallback to local catalog.json in current working directory
                path = "catalog.json"

            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Error: {self.filepath} not found.")
            return []
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON from {self.filepath}: {e}")
            return []
        except Exception as e:
            print(f"Unexpected error loading catalog: {e}")
            return []

    def get_catalog(self):
        return self._catalog

    def get_product(self, product_id):
        try:
            return next(
                (p for p in self._catalog if p.get("id") == product_id),
                None
            )
        except Exception as e:
            print(f"Error in get_product logic: {e}")
            return None

    def search_catalog(self, filters):
        try:
            results = []
            for item in self._catalog:
                # Check category filter
                category_filter = filters.get("category")
                if category_filter is not None:
                    item_cat = item.get("category", "")
                    if not item_cat or item_cat.lower() != category_filter.lower():
                        continue

                # Check color filter
                color_filter = filters.get("color")
                if color_filter is not None:
                    item_color = item.get("color", "")
                    if not item_color or item_color.lower() != color_filter.lower():
                        continue

                # Check price range filters
                price = item.get("price")
                if price is not None:
                    max_price = filters.get("max_price")
                    if max_price is not None and price > max_price:
                        continue
                    min_price = filters.get("min_price")
                    if min_price is not None and price < min_price:
                        continue

                # Check occasion filter
                occasion_filter = filters.get("occasion")
                if occasion_filter is not None:
                    item_occ = item.get("occasion", "")
                    if not item_occ or item_occ.lower() != occasion_filter.lower():
                        continue

                results.append(item)
            return results
        except Exception as e:
            print(f"Error filtering search catalog: {e}")
            return []
