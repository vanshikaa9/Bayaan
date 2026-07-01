import os
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify
from services.search_services import search_products
from services.product_services import get_product

load_dotenv()


app = Flask(__name__)


REPLAN_MESSAGES = {
    "replan_color": "No exact match found. Showing similar options within your budget.",
    "replan_price": "No exact match in your budget. Showing same category at different prices.",
    "replan_category": "That category wasn't available. Showing similar color options.",
    "replan_none": "Nothing relevant found. Try simplifying your search."
}

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

    if not query:
        return jsonify({
            "results": [],
            "filters": {},
            "message": ""
        })

    response = search_products(
        query,
        REPLAN_MESSAGES
    )

    return jsonify(response)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)