from flask import Flask, render_template, request, jsonify
from bayaan import (
    parse_query,
    search_catalog,
    replan,
    recover_category,
    correct_category,
    normalize_query,
    has_filters,
    load_catalog
)

app = Flask(__name__)
catalog = load_catalog()

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

@app.route("/search", methods=["POST"])
def search():
    data = request.get_json()
    query = data.get("query", "").strip()

    if not query:
        return jsonify({"results": [], "filters": {}, "message": ""})

    normalized = normalize_query(query)
    filters = parse_query(normalized)
    filters = recover_category(normalized, filters)

    original_category = filters.get("category")
    filters["category"] = correct_category(original_category)

    if not has_filters(filters):
        return jsonify({
            "results": [],
            "filters": filters,
            "message": "Couldn't understand your search. Try again."
        })

    results = search_catalog(filters, catalog)
    message = ""

    if not results:
        results, message = replan(filters, catalog, REPLAN_MESSAGES)

    return jsonify({
        "results": results,
        "filters": filters,
        "message": message
    })

if __name__ == "__main__":
    app.run(debug=True)