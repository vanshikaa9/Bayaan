from providers.json_provider import JsonProvider

provider = JsonProvider()


def get_catalog():
    try:
        return provider.get_catalog()
    except Exception as e:
        print(f"Error in product_services.get_catalog: {e}")
        return []


def get_product(product_id):
    try:
        return provider.get_product(product_id)
    except Exception as e:
        print(f"Error in product_services.get_product: {e}")
        return None