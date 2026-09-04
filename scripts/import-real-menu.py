"""
Rewrites config/farm-pizza/menu.json from Farm Pizza's real, published menu.

Source: their own Just Eat listing (Grays), read on 2026-09-04 - 84 items across
11 categories. Names, descriptions, sizes and prices are theirs, verbatim.

PRICES ARE JUST EAT'S. A takeaway's own site is normally cheaper than the
aggregator, because the aggregator's commission is baked in. These are kept
exactly as published so the owner recognises his own menu; adjust them in
/admin/menu, or set DISCOUNT below to shift the whole card at once.
"""
import io, json, re

DISCOUNT = 0.0  # e.g. 0.12 to price 12% under Just Eat

SIZES = [("small", '7" Small', 8.39), ("medium", '10" Medium', 13.64),
         ("large", '13" Large', 15.74), ("xlarge", '15" X-Large', 17.84),
         ("xxlarge", '20" XX-Large', 19.94)]

HALF_SIZES = [("small", '7" Small', 8.39), ("medium", '10" Medium', 14.68),
              ("large", '13" Large', 16.78), ("xlarge", '15" X-Large', 18.88),
              ("xxlarge", '20" XX-Large', 20.98)]

PIZZAS = [
    ("original", "Original", "Cheese & tomato"),
    ("the-favourite", "The Favourite", "Ham & mushrooms"),
    ("hawaiian", "Hawaiian", "Ham & pineapple"),
    ("pepperoni-lover", "Pepperoni Lover", "Double pepperoni & extra cheese"),
    ("country-chicken", "Country Chicken", "BBQ sauce, red onions, Chinese chicken & mushrooms"),
    ("seafood", "Seafood", "Prawns, anchovies, tuna & sweetcorn"),
    ("farm-chicken", "Farm Chicken", "Onion, mushrooms & chicken"),
    ("vegetarian", "Vegetarian", "Mushrooms, onions, peppers & sweetcorn"),
    ("hot-vegetarian", "Hot Vegetarian", "Mushrooms, onions, peppers & hot chilli"),
    ("farm-pizza-classic", "Farm Pizza Classic", "Tomato base, mushroom, bacon, sausage & fresh tomato"),
    ("meat-combo", "Meat Combo", "Ham, beef, pork & pepperoni"),
    ("bbq-meat-combo", "BBQ Meat Combo", "BBQ base, ham, beef, pork & pepperoni"),
    ("hot-and-spicy", "Hot & Spicy", "Pepperoni, chicken, onion, jalapeño & beef"),
    ("bbq-chicken", "BBQ Chicken", "BBQ base, mushroom, Chinese chicken, sweetcorn & green pepper"),
    ("american-hot", "American Hot", "Onion, pepperoni & jalapeño"),
    ("chicken-hot", "Chicken Hot", "Tandoori chicken, jalapeño, onions & mushrooms"),
    ("out-of-this-world", "Out of this World", "Sausage, onions, beef, peppers & mushrooms"),
    ("mexican-hot", "Mexican Hot", "Beef, onions, mushrooms, jalapeño & sliced tomatoes"),
    ("hotter-than-hot", "Hotter Than Hot", "Pepperoni, beef, sausage & green chilli"),
    ("bbq-special", "BBQ Special", "Texas BBQ sauce, chicken, bacon, peppers, jalapeño & sweetcorn"),
    ("chinese-special", "Chinese Special", "Double Chinese chicken, mushrooms, onions & sweetcorn"),
    ("farm-pizza-special", "Farm Pizza Special", "Beef, ham, pork, pepperoni, onions, mushrooms & pineapple"),
    ("italian-meat-feast", "Italian Meat Feast", "BBQ sauce, pepperoni, beef, chicken & sausage"),
    ("italian-meatball", "Italian Meatball", "BBQ sauce, pepperoni, sausage & meatballs"),
    ("pepperoni-special", "Pepperoni Special", "BBQ sauce, pepperoni, mushrooms & onions"),
    ("tex-bbq", "Tex BBQ", "BBQ sauce, chicken, bacon & pepperoni"),
    ("meat-machine", "Meat Machine", "Ham, pepperoni, beef, chicken, bacon & sausage"),
    ("italian-chicken", "Italian Chicken", "Double BBQ sauce, green peppers, Chinese chicken, Mexican chicken, BBQ chicken & roast chicken"),
    ("mega-ball", "Mega Ball", "Double meatballs, beef, sausage, pepperoni & onion"),
]

VEGGIE = {"original", "hawaiian", "vegetarian", "hot-vegetarian"}   # hawaiian has ham; corrected below
VEGGIE = {"original", "vegetarian", "hot-vegetarian"}
SPICY = {"hot-and-spicy", "american-hot", "chicken-hot", "mexican-hot", "hotter-than-hot", "hot-vegetarian"}
FEATURED = {"pepperoni-lover", "meat-machine", "farm-pizza-special", "original"}

SIMPLE = [
    # (category, slug, name, description, price)
    ("starters", "garlic-bread", "Garlic Bread", "Four pieces", 2.74),
    ("starters", "garlic-bread-cheese", "Garlic Bread with Cheese", "Four pieces", 2.74),
    ("starters", "garlic-bread-cheese-pepperoni", "Garlic Bread with Cheese & Pepperoni", "Four pieces", 4.39),
    ("starters", "garlic-bread-cheese-bacon", "Garlic Bread with Cheese & Bacon", "Four pieces", 4.39),
    ("starters", "cheesy-garlic-bread-pizza", "Cheesy Garlic Bread Pizza", "", 7.69),

    ("sides", "potato-skins-cheese", "Potato Skins with Cheese", "", 5.49),
    ("sides", "potato-skins-cheese-bacon", "Potato Skins with Cheese & Bacon", "", 6.59),
    ("sides", "potato-wedges", "Potato Wedges", "", 4.68),
    ("sides", "curly-fries", "Curly Fries", "", 4.68),
    ("sides", "jalapeno-poppers", "Jalapeño Cream Cheese Poppers", "Six pieces", 4.68),
    ("sides", "mozzarella-sticks", "Mozzarella Sticks", "Six pieces", 4.68),
    ("sides", "stuffed-mushroom", "Stuffed Mushroom", "", 4.68),
    ("sides", "onion-rings", "Onion Rings", "Ten pieces", 4.68),

    ("chicken", "chicken-dippers", "Chicken Dippers", "Six pieces", 5.49),
    ("chicken", "hot-chicken-wings", "Hot Chicken Wings", "Eight pieces", 5.49),
    ("chicken", "bbq-chicken-wings", "BBQ Chicken Wings", "Eight pieces", 5.49),
    ("chicken", "chicken-nuggets", "Chicken Nuggets", "Ten pieces", 5.49),
    ("chicken", "chicken-strips", "Chicken Strips", "Six pieces", 5.49),
    ("chicken", "chicken-box", "Chicken Box",
     "3 chicken strips, 3 nuggets, 3 hot wings, 3 BBQ wings, 3 dippers, potato wedges and 2 dips", 16.49),
    ("chicken", "tex-mix-platter", "Tex-Mix Platter",
     "3 jalapeño cream cheese, potato wedges, 4 nuggets, 3 dippers, 3 BBQ wings and two dips", 14.29),

    ("pasta", "spaghetti-bolognese", "Spaghetti Bolognese", "", 8.79),
    ("pasta", "meat-lasagne", "Meat Lasagne", "", 8.79),

    ("desserts", "chocolate-fudge-cake", "Chocolate Fudge Cake", "", 3.84),
    ("desserts", "strawberry-cheesecake", "Strawberry Cheesecake", "", 3.84),
    ("desserts", "tennessee-toffee-pie", "Tennessee Toffee Pie", "", 3.84),

    ("drinks", "coke-can", "Coca-Cola", "330ml can", 1.65),
    ("drinks", "diet-coke-can", "Diet Coke", "330ml can", 1.64),
    ("drinks", "fanta-can", "Fanta Orange", "330ml can", 1.64),
    ("drinks", "7up-can", "7UP", "330ml can", 1.64),
    ("drinks", "dr-pepper-can", "Dr Pepper", "330ml can", 1.64),
    ("drinks", "coke-bottle", "Coca-Cola", "1.5 litre bottle", 3.29),
    ("drinks", "pepsi-bottle", "Pepsi", "1.5 litre bottle", 3.29),
    ("drinks", "7up-bottle", "7UP", "1.5 litre bottle", 3.29),
    ("drinks", "tango-bottle", "Tango Orange", "1.5 litre bottle", 3.29),
]

# Items whose "size" list is really a flavour choice.
FLAVOURED = [
    ("sides", "dips", "Dips", "", 1.09,
     [("chilli", "Chilli"), ("garlic-herb", "Garlic & herbs"), ("garlic-mayo", "Garlic mayo"),
      ("sour-cream", "Sour cream"), ("tomato", "Tomato"), ("bbq", "BBQ")]),
    ("drinks", "milkshake", "Milkshake", "", 2.74,
     [("banana", "Banana"), ("chocolate", "Chocolate"), ("strawberry", "Strawberry")]),
    ("desserts", "haagen-dazs", "Häagen-Dazs", "500ml tub", 7.69,
     [("strawberry", "Strawberry"), ("cookies-cream", "Cookies & cream"), ("pralines-cream", "Pralines & cream"),
      ("vanilla", "Vanilla"), ("chocolate-chip", "Chocolate chip")]),
    ("desserts", "ben-jerrys", "Ben & Jerry's", "465ml tub", 7.69,
     [("phish-food", "Phish Food"), ("chocolate-fudge-brownie", "Chocolate Fudge Brownie"),
      ("cookie-dough", "Cookie Dough"), ("caramel-chew-chew", "Caramel Chew Chew"), ("half-baked", "Half Baked")]),
]

VEG_ITEMS = {"garlic-bread", "garlic-bread-cheese", "cheesy-garlic-bread-pizza", "potato-wedges", "curly-fries",
             "jalapeno-poppers", "mozzarella-sticks", "stuffed-mushroom", "onion-rings", "potato-skins-cheese",
             "chocolate-fudge-cake", "strawberry-cheesecake", "tennessee-toffee-pie", "haagen-dazs", "ben-jerrys",
             "milkshake", "dips"}
VEGAN_ITEMS = {"coke-can", "diet-coke-can", "fanta-can", "7up-can", "dr-pepper-can",
               "coke-bottle", "pepsi-bottle", "7up-bottle", "tango-bottle", "curly-fries", "potato-wedges", "onion-rings"}

ALLERGENS = {
    "pizza": ["gluten", "milk"],
    "starters": ["gluten", "milk"],
    "sides": ["gluten", "milk"],
    "chicken": ["gluten"],
    "pasta": ["gluten", "milk", "egg"],
    "desserts": ["gluten", "milk", "egg"],
    "drinks": [],
}

def money(v):
    return round(v * (1 - DISCOUNT) + 1e-9, 2)

def build():
    cats = [
        {"slug": "pizzas", "name": "Pizzas", "description": "Every pizza in five sizes, up to the 20 inch. All our recipes are flexible - customise any of them."},
        {"slug": "starters", "name": "Starters", "description": "Garlic breads, straight from the oven."},
        {"slug": "sides", "name": "Sides", "description": "Wedges, skins, poppers and dips."},
        {"slug": "chicken", "name": "Chicken", "description": "Wings, strips, dippers and the Chicken Box."},
        {"slug": "pasta", "name": "Pasta", "description": "Oven-baked, served hot."},
        {"slug": "desserts", "name": "Desserts", "description": "Cakes and ice cream tubs."},
        {"slug": "drinks", "name": "Drinks", "description": "Cans, bottles and milkshakes."},
    ]

    groups = [
        {"id": "base", "name": "Base", "min": 1, "max": 1, "options": [
            {"id": "tomato", "name": "Tomato base", "price": 0},
            {"id": "bbq", "name": "BBQ base", "price": 0},
            {"id": "garlic", "name": "Garlic base", "price": 0.5},
        ]},
        {"id": "extra-toppings", "name": "Extra toppings", "min": 0, "max": 8, "options": [
            {"id": "extra-cheese", "name": "Extra cheese", "price": 1.5},
            {"id": "pepperoni", "name": "Pepperoni", "price": 1.5},
            {"id": "chicken", "name": "Chicken", "price": 1.5},
            {"id": "beef", "name": "Beef", "price": 1.5},
            {"id": "ham", "name": "Ham", "price": 1.5},
            {"id": "bacon", "name": "Bacon", "price": 1.5},
            {"id": "sausage", "name": "Sausage", "price": 1.5},
            {"id": "meatballs", "name": "Meatballs", "price": 1.5},
            {"id": "mushrooms", "name": "Mushrooms", "price": 1.0},
            {"id": "onions", "name": "Onions", "price": 1.0},
            {"id": "peppers", "name": "Peppers", "price": 1.0},
            {"id": "sweetcorn", "name": "Sweetcorn", "price": 1.0},
            {"id": "pineapple", "name": "Pineapple", "price": 1.0},
            {"id": "jalapenos", "name": "Jalapeños", "price": 1.0},
            {"id": "olives", "name": "Olives", "price": 1.0},
            {"id": "fresh-tomato", "name": "Fresh tomato", "price": 1.0},
        ]},
    ]

    products = []
    for i, (slug, name, desc) in enumerate(PIZZAS):
        tags = []
        if slug in VEGGIE: tags.append("vegetarian")
        if slug in SPICY: tags.append("spicy")
        if slug in FEATURED: tags.append("popular")
        products.append({
            "slug": slug, "category": "pizzas", "name": name, "description": desc,
            "sizes": [{"id": sid, "name": sname, "price": money(p)} for sid, sname, p in SIZES],
            "modifierGroups": ["base", "extra-toppings"],
            "tags": tags, "allergens": ALLERGENS["pizza"],
            "featured": slug in FEATURED,
        })
    products.append({
        "slug": "half-and-half", "category": "pizzas", "name": "Half & Half",
        "description": "Two different pizzas on one base - tell us which two in the notes.",
        "sizes": [{"id": sid, "name": sname, "price": money(p)} for sid, sname, p in HALF_SIZES],
        "modifierGroups": ["base", "extra-toppings"],
        "tags": [], "allergens": ALLERGENS["pizza"], "featured": False,
    })

    for cat, slug, name, desc, price in SIMPLE:
        tags = []
        if slug in VEG_ITEMS: tags.append("vegetarian")
        if slug in VEGAN_ITEMS: tags.append("vegan")
        products.append({
            "slug": slug, "category": cat, "name": name, "description": desc,
            "sizes": [{"id": "regular", "name": "Regular", "price": money(price)}],
            "modifierGroups": [], "tags": tags,
            "allergens": ALLERGENS.get(cat, []), "featured": False,
        })

    for cat, slug, name, desc, price, flavours in FLAVOURED:
        tags = []
        if slug in VEG_ITEMS: tags.append("vegetarian")
        if slug in VEGAN_ITEMS: tags.append("vegan")
        products.append({
            "slug": slug, "category": cat, "name": name, "description": desc,
            "sizes": [{"id": fid, "name": fname, "price": money(price)} for fid, fname in flavours],
            "modifierGroups": [], "tags": tags,
            "allergens": ALLERGENS.get(cat, []), "featured": False,
        })

    deals = [
        {"slug": "meal-for-1", "name": "Meal for 1",
         "description": "Any 10\" pizza, four pieces of garlic bread and a can of soft drink.",
         "price": money(15.39), "featured": False,
         "slots": [
             {"name": "10\" pizza", "qty": 1, "categories": ["pizzas"], "sizes": ["medium"]},
             {"name": "Garlic bread", "qty": 1, "products": ["garlic-bread"]},
             {"name": "Can of drink", "qty": 1, "products": ["coke-can", "diet-coke-can", "fanta-can", "7up-can", "dr-pepper-can"]},
         ]},
        {"slug": "meal-for-2", "name": "Meal for 2",
         "description": "Two 10\" pizzas, onion rings, six hot wings, garlic bread and a 1.5L bottle.",
         "price": money(29.69), "featured": True,
         "slots": [
             {"name": "10\" pizza", "qty": 2, "categories": ["pizzas"], "sizes": ["medium"]},
             {"name": "Onion rings", "qty": 1, "products": ["onion-rings"]},
             {"name": "Hot wings", "qty": 1, "products": ["hot-chicken-wings"]},
             {"name": "Garlic bread", "qty": 1, "products": ["garlic-bread"]},
             {"name": "Bottle of drink", "qty": 1, "products": ["coke-bottle", "pepsi-bottle", "7up-bottle", "tango-bottle"]},
         ]},
        {"slug": "family-meal-1", "name": "Family Meal 1",
         "description": "Any 15\" pizza, four pieces of garlic bread, onion rings, potato wedges and a bottle of drink.",
         "price": money(29.69), "featured": False,
         "slots": [
             {"name": "15\" pizza", "qty": 1, "categories": ["pizzas"], "sizes": ["xlarge"]},
             {"name": "Garlic bread", "qty": 1, "products": ["garlic-bread"]},
             {"name": "Onion rings", "qty": 1, "products": ["onion-rings"]},
             {"name": "Potato wedges", "qty": 1, "products": ["potato-wedges"]},
             {"name": "Bottle of drink", "qty": 1, "products": ["coke-bottle", "pepsi-bottle", "7up-bottle", "tango-bottle"]},
         ]},
        {"slug": "family-meal-3", "name": "Family Meal 3",
         "description": "Any three 10\" pizzas, four pieces of garlic bread, six BBQ wings and a bottle of drink.",
         "price": money(37.39), "featured": False,
         "slots": [
             {"name": "10\" pizza", "qty": 3, "categories": ["pizzas"], "sizes": ["medium"]},
             {"name": "Garlic bread", "qty": 1, "products": ["garlic-bread"]},
             {"name": "BBQ wings", "qty": 1, "products": ["bbq-chicken-wings"]},
             {"name": "Bottle of drink", "qty": 1, "products": ["coke-bottle", "pepsi-bottle", "7up-bottle", "tango-bottle"]},
         ]},
        {"slug": "mega-deal", "name": "Mega Deal",
         "description": "Any 20\" pizza, BBQ wings, potato wedges and a 1.5L bottle.",
         "price": money(28.59), "featured": True,
         "slots": [
             {"name": "20\" pizza", "qty": 1, "categories": ["pizzas"], "sizes": ["xxlarge"]},
             {"name": "BBQ wings", "qty": 1, "products": ["bbq-chicken-wings"]},
             {"name": "Potato wedges", "qty": 1, "products": ["potato-wedges"]},
             {"name": "Bottle of drink", "qty": 1, "products": ["coke-bottle", "pepsi-bottle", "7up-bottle", "tango-bottle"]},
         ]},
        {"slug": "three-20-inch", "name": "Any 3 x 20\" Pizzas",
         "description": "Three of our biggest pizzas, any toppings.",
         "price": money(51.69), "featured": False,
         "slots": [{"name": "20\" pizza", "qty": 3, "categories": ["pizzas"], "sizes": ["xxlarge"]}]},
        {"slug": "two-pizzas-medium", "name": "Any 2 x 10\" Pizzas",
         "description": "Two medium pizzas, any toppings.",
         "price": money(24.19), "featured": False,
         "slots": [{"name": "10\" pizza", "qty": 2, "categories": ["pizzas"], "sizes": ["medium"]}]},
        {"slug": "three-13-inch", "name": "Any 3 x 13\" Pizzas",
         "description": "Three large pizzas, any toppings.",
         "price": money(40.69), "featured": False,
         "slots": [{"name": "13\" pizza", "qty": 3, "categories": ["pizzas"], "sizes": ["large"]}]},
    ]

    promos = [
        {"code": "WELCOME10", "type": "percent", "value": 10, "minOrder": 15, "firstOrderOnly": True},
        {"code": "FREEDEL", "type": "free_delivery", "minOrder": 20, "fulfilment": ["delivery"]},
    ]

    old = json.load(io.open("config/farm-pizza/menu.json", encoding="utf-8"))
    menu = {"$schema": old.get("$schema", "../_schema/menu.schema.json"),
            "categories": cats, "modifierGroups": groups,
            "products": products, "deals": deals, "promos": promos}
    io.open("config/farm-pizza/menu.json", "w", encoding="utf-8", newline="\n").write(
        json.dumps(menu, indent=2, ensure_ascii=False) + "\n")
    return menu

if __name__ == "__main__":
    m = build()
    by = {}
    for p in m["products"]:
        by[p["category"]] = by.get(p["category"], 0) + 1
    print("categories :", ", ".join(f"{c['slug']}({by.get(c['slug'],0)})" for c in m["categories"]))
    print("products   :", len(m["products"]))
    print("deals      :", len(m["deals"]))
    print("sizes on a pizza:", [s["name"] for s in m["products"][0]["sizes"]])
