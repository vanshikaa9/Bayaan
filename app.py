import os
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify
from services.search_services import search_products
from services.product_services import get_product, get_catalog
from bayaan import GROQ_API_KEY, GROQ_MODEL

load_dotenv()


app = Flask(__name__)


def log_startup():
    print("Bayaan starting")

    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.isfile(env_path):
        print("  Warning: .env file not found — using environment variables or defaults")

    catalog = get_catalog()
    product_count = len(catalog) if catalog else 0
    print("  Provider: json")
    if product_count == 0:
        print("  Warning: Catalog is empty — check catalog.json")
    else:
        print(f"  Catalog: {product_count} products loaded")

    if GROQ_API_KEY:
        print(f"  LLM: groq (model: {GROQ_MODEL})")
        print("  Parser fallback: available (regex)")
    else:
        print("  Warning: GROQ_API_KEY not set — using regex parser fallback")
        print("  LLM: unavailable")
        print("  Parser: regex fallback (automatic)")

    port = os.environ.get("PORT", "5000")
    print(f"  Port: {port}")


log_startup()

@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "provider": "json",
        "llm": "groq" if GROQ_API_KEY else "regex",
        "fallback_available": True
    })

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/results")
def results():
    return render_template("results.html")

@app.route("/product/<int:product_id>")
@app.route("/product/<int:product_id>/<slug>")
def product_page(product_id, slug=None):
    item = get_product(product_id)
    if not item:
        return render_template("index.html"), 404
    return render_template("product.html", product=item)

@app.route("/search", methods=["POST"])
def search():

    data = request.get_json()

    query = data.get("query", "").strip()
    lang = data.get("lang", "en-IN")

    if not query:
        return jsonify({
            "results": [],
            "filters": {},
            "message": ""
        })

    response = search_products(query, lang)

    return jsonify(response)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)