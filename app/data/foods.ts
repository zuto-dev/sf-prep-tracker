// Static common-foods DB. Values per 100g unless the "unit" says otherwise.
// Curated for reliability — no external API dependency at runtime.
// Sources: USDA FoodData Central, MyFitnessPal reference values, product nutrition labels.

export type Food = {
  id: string;
  name: string;
  cat: 'protein' | 'carb' | 'fat' | 'veg' | 'fruit' | 'dairy' | 'drink' | 'snack' | 'meal';
  serving: string;   // human label of one serving
  servingG: number;  // grams in that serving
  kcal: number;      // kcal per serving
  p: number;         // protein g per serving
  c: number;         // carbs g per serving
  f: number;         // fat g per serving
};

const HIDDEN_FOOD_IDS = new Set(['tuna-canned', 'salmon', 'shrimp', 'tilapia']);

export const FOODS: Food[] = [
  // Proteins
  { id: 'chicken-breast', name: 'Chicken Breast, skinless',      cat: 'protein', serving: '100g cooked',       servingG: 100, kcal: 165, p: 31,  c: 0,  f: 3.6 },
  { id: 'chicken-thigh',  name: 'Chicken Thigh, skinless',       cat: 'protein', serving: '100g cooked',       servingG: 100, kcal: 209, p: 26,  c: 0,  f: 11 },
  { id: 'rotisserie',     name: 'Rotisserie Chicken (meat)',     cat: 'protein', serving: '6 oz (170g)',       servingG: 170, kcal: 320, p: 44,  c: 0,  f: 15 },
  { id: 'ground-beef-90', name: 'Ground Beef 90/10',             cat: 'protein', serving: '4 oz cooked',       servingG: 113, kcal: 200, p: 25,  c: 0,  f: 11 },
  { id: 'ground-beef-85', name: 'Ground Beef 85/15',             cat: 'protein', serving: '4 oz cooked',       servingG: 113, kcal: 240, p: 24,  c: 0,  f: 15 },
  { id: 'steak-sirloin',  name: 'Sirloin Steak',                 cat: 'protein', serving: '6 oz cooked',       servingG: 170, kcal: 340, p: 46,  c: 0,  f: 16 },
  { id: 'pork-loin',      name: 'Pork Loin',                     cat: 'protein', serving: '4 oz cooked',       servingG: 113, kcal: 200, p: 26,  c: 0,  f: 10 },
  { id: 'bacon',          name: 'Bacon',                         cat: 'protein', serving: '2 slices',          servingG: 16,  kcal: 90,  p: 6,   c: 0,  f: 7 },
  { id: 'ham',            name: 'Deli Ham',                      cat: 'protein', serving: '2 oz (56g)',        servingG: 56,  kcal: 60,  p: 10,  c: 2,  f: 1.5 },
  { id: 'turkey-deli',    name: 'Deli Turkey',                   cat: 'protein', serving: '2 oz (56g)',        servingG: 56,  kcal: 60,  p: 12,  c: 1,  f: 1 },
  { id: 'ground-turkey',  name: 'Ground Turkey 93/7',            cat: 'protein', serving: '4 oz cooked',       servingG: 113, kcal: 170, p: 22,  c: 0,  f: 9 },
  { id: 'salmon',         name: 'Salmon, Atlantic',              cat: 'protein', serving: '6 oz cooked',       servingG: 170, kcal: 350, p: 40,  c: 0,  f: 20 },
  { id: 'tuna-canned',    name: 'Canned Tuna in Water',          cat: 'protein', serving: '1 can (5oz drained)', servingG: 140, kcal: 130, p: 30,  c: 0,  f: 1.5 },
  { id: 'tilapia',        name: 'Tilapia',                       cat: 'protein', serving: '6 oz cooked',       servingG: 170, kcal: 210, p: 46,  c: 0,  f: 3 },
  { id: 'shrimp',         name: 'Shrimp',                        cat: 'protein', serving: '4 oz cooked',       servingG: 113, kcal: 110, p: 24,  c: 1,  f: 1 },
  { id: 'egg-whole',      name: 'Egg, whole large',              cat: 'protein', serving: '1 egg (50g)',       servingG: 50,  kcal: 72,  p: 6,   c: 0.4,f: 5 },
  { id: 'egg-white',      name: 'Egg White',                     cat: 'protein', serving: '1 white (33g)',     servingG: 33,  kcal: 17,  p: 3.6, c: 0.2,f: 0.1 },
  { id: 'whey-scoop',     name: 'Whey Protein (1 scoop)',        cat: 'protein', serving: '1 scoop (~30g)',    servingG: 30,  kcal: 120, p: 24,  c: 3,  f: 1.5 },
  { id: 'whey-1_5',       name: 'Whey Shake (1.5 scoop + 2% milk 12oz)', cat: 'protein', serving: '1 shake', servingG: 400, kcal: 300, p: 42, c: 22, f: 8 },
  { id: 'greek-yogurt',   name: 'Greek Yogurt, plain nonfat',    cat: 'dairy',   serving: '1 cup (227g)',      servingG: 227, kcal: 130, p: 22,  c: 9,  f: 0.5 },
  { id: 'greek-yogurt-2', name: 'Greek Yogurt, plain 2%',        cat: 'dairy',   serving: '1 cup (227g)',      servingG: 227, kcal: 180, p: 20,  c: 8,  f: 4.5 },
  { id: 'cottage-cheese', name: 'Cottage Cheese, low-fat',       cat: 'dairy',   serving: '1 cup (226g)',      servingG: 226, kcal: 180, p: 24,  c: 8,  f: 5 },
  { id: 'milk-whole',     name: 'Milk, whole',                   cat: 'dairy',   serving: '1 cup (240ml)',     servingG: 240, kcal: 150, p: 8,   c: 12, f: 8 },
  { id: 'milk-2',         name: 'Milk, 2%',                      cat: 'dairy',   serving: '1 cup (240ml)',     servingG: 240, kcal: 122, p: 8,   c: 12, f: 5 },
  { id: 'milk-skim',      name: 'Milk, skim',                    cat: 'dairy',   serving: '1 cup (240ml)',     servingG: 240, kcal: 83,  p: 8,   c: 12, f: 0.2 },
  { id: 'cheddar',        name: 'Cheddar Cheese',                cat: 'dairy',   serving: '1 oz (28g)',        servingG: 28,  kcal: 115, p: 7,   c: 0.4,f: 9 },
  { id: 'mozz',           name: 'Mozzarella, part-skim',         cat: 'dairy',   serving: '1 oz (28g)',        servingG: 28,  kcal: 72,  p: 7,   c: 0.8,f: 4.5 },
  { id: 'parmesan',       name: 'Parmesan, grated',              cat: 'dairy',   serving: '1 tbsp (5g)',       servingG: 5,   kcal: 22,  p: 2,   c: 0.2,f: 1.5 },
  { id: 'butter',         name: 'Butter',                        cat: 'fat',     serving: '1 tbsp (14g)',      servingG: 14,  kcal: 100, p: 0,   c: 0,  f: 11 },

  // Carbs / grains
  { id: 'rice-white',     name: 'White Rice, cooked',            cat: 'carb',    serving: '1 cup (158g)',      servingG: 158, kcal: 205, p: 4.3, c: 45, f: 0.4 },
  { id: 'rice-brown',     name: 'Brown Rice, cooked',            cat: 'carb',    serving: '1 cup (195g)',      servingG: 195, kcal: 216, p: 5,   c: 45, f: 1.8 },
  { id: 'jasmine-pouch',  name: 'Jasmine Rice Pouch',            cat: 'carb',    serving: '1 pouch (8.5oz)',   servingG: 241, kcal: 340, p: 6,   c: 74, f: 1 },
  { id: 'oats-dry',       name: 'Rolled Oats, dry',              cat: 'carb',    serving: '1/2 cup dry (40g)', servingG: 40,  kcal: 150, p: 5,   c: 27, f: 3 },
  { id: 'oats-cup',       name: 'Oatmeal, 1 cup cooked',         cat: 'carb',    serving: '1 cup cooked',      servingG: 234, kcal: 165, p: 6,   c: 28, f: 3.5 },
  { id: 'bread-white',    name: 'Bread, white',                  cat: 'carb',    serving: '1 slice',           servingG: 28,  kcal: 75,  p: 3,   c: 14, f: 1 },
  { id: 'bread-wheat',    name: 'Bread, whole wheat',            cat: 'carb',    serving: '1 slice',           servingG: 28,  kcal: 80,  p: 4,   c: 14, f: 1 },
  { id: 'bagel',          name: 'Bagel, plain',                  cat: 'carb',    serving: '1 medium (105g)',   servingG: 105, kcal: 280, p: 11,  c: 55, f: 1.5 },
  { id: 'tortilla-flour', name: 'Tortilla, flour 8"',            cat: 'carb',    serving: '1 tortilla (49g)',  servingG: 49,  kcal: 150, p: 4,   c: 25, f: 4 },
  { id: 'tortilla-corn',  name: 'Tortilla, corn 6"',             cat: 'carb',    serving: '1 tortilla (24g)',  servingG: 24,  kcal: 55,  p: 1.4, c: 12, f: 0.6 },
  { id: 'pasta-cooked',   name: 'Pasta, cooked',                 cat: 'carb',    serving: '1 cup (140g)',      servingG: 140, kcal: 220, p: 8,   c: 43, f: 1.3 },
  { id: 'potato',         name: 'Potato, baked w/ skin',         cat: 'carb',    serving: '1 medium (173g)',   servingG: 173, kcal: 161, p: 4.3, c: 37, f: 0.2 },
  { id: 'sweet-potato',   name: 'Sweet Potato, baked',           cat: 'carb',    serving: '1 medium (128g)',   servingG: 128, kcal: 112, p: 2,   c: 26, f: 0.1 },
  { id: 'quinoa',         name: 'Quinoa, cooked',                cat: 'carb',    serving: '1 cup (185g)',      servingG: 185, kcal: 222, p: 8,   c: 39, f: 3.6 },
  { id: 'granola',        name: 'Granola',                       cat: 'carb',    serving: '1/4 cup (30g)',     servingG: 30,  kcal: 130, p: 3,   c: 20, f: 4 },
  { id: 'cereal-cheerios',name: 'Cheerios',                      cat: 'carb',    serving: '1 cup (28g)',       servingG: 28,  kcal: 100, p: 3,   c: 20, f: 2 },

  // Fruits
  { id: 'banana',         name: 'Banana',                        cat: 'fruit',   serving: '1 medium (118g)',   servingG: 118, kcal: 105, p: 1.3, c: 27, f: 0.4 },
  { id: 'apple',          name: 'Apple',                         cat: 'fruit',   serving: '1 medium (182g)',   servingG: 182, kcal: 95,  p: 0.5, c: 25, f: 0.3 },
  { id: 'orange',         name: 'Orange',                        cat: 'fruit',   serving: '1 medium (131g)',   servingG: 131, kcal: 62,  p: 1.2, c: 15, f: 0.2 },
  { id: 'berries-mixed',  name: 'Berries, mixed',                cat: 'fruit',   serving: '1/2 cup (75g)',     servingG: 75,  kcal: 40,  p: 0.6, c: 10, f: 0.2 },
  { id: 'blueberries',    name: 'Blueberries',                   cat: 'fruit',   serving: '1 cup (148g)',      servingG: 148, kcal: 84,  p: 1.1, c: 21, f: 0.5 },
  { id: 'strawberries',   name: 'Strawberries',                  cat: 'fruit',   serving: '1 cup (152g)',      servingG: 152, kcal: 49,  p: 1,   c: 12, f: 0.5 },
  { id: 'grapes',         name: 'Grapes',                        cat: 'fruit',   serving: '1 cup (151g)',      servingG: 151, kcal: 104, p: 1.1, c: 27, f: 0.2 },
  { id: 'mango',          name: 'Mango',                         cat: 'fruit',   serving: '1 cup (165g)',      servingG: 165, kcal: 99,  p: 1.4, c: 25, f: 0.6 },
  { id: 'pineapple',      name: 'Pineapple',                     cat: 'fruit',   serving: '1 cup (165g)',      servingG: 165, kcal: 82,  p: 0.9, c: 22, f: 0.2 },
  { id: 'watermelon',     name: 'Watermelon',                    cat: 'fruit',   serving: '1 cup (152g)',      servingG: 152, kcal: 46,  p: 0.9, c: 12, f: 0.2 },
  { id: 'avocado',        name: 'Avocado',                       cat: 'fat',     serving: '1/2 fruit (100g)',  servingG: 100, kcal: 160, p: 2,   c: 9,  f: 15 },

  // Vegetables
  { id: 'broccoli',       name: 'Broccoli, steamed',             cat: 'veg',     serving: '1 cup (156g)',      servingG: 156, kcal: 55,  p: 4,   c: 11, f: 0.6 },
  { id: 'spinach',        name: 'Spinach, raw',                  cat: 'veg',     serving: '1 cup (30g)',       servingG: 30,  kcal: 7,   p: 0.9, c: 1,  f: 0.1 },
  { id: 'carrots',        name: 'Carrots, raw',                  cat: 'veg',     serving: '1 cup (128g)',      servingG: 128, kcal: 52,  p: 1.2, c: 12, f: 0.3 },
  { id: 'bell-pepper',    name: 'Bell Pepper',                   cat: 'veg',     serving: '1 medium (119g)',   servingG: 119, kcal: 30,  p: 1,   c: 7,  f: 0.3 },
  { id: 'green-beans',    name: 'Green Beans, cooked',           cat: 'veg',     serving: '1 cup (125g)',      servingG: 125, kcal: 44,  p: 2.4, c: 10, f: 0.4 },
  { id: 'frozen-mixed',   name: 'Frozen Mixed Veg',              cat: 'veg',     serving: '1 cup (91g)',       servingG: 91,  kcal: 60,  p: 3,   c: 12, f: 0.2 },
  { id: 'lettuce',        name: 'Lettuce, romaine',              cat: 'veg',     serving: '2 cups (94g)',      servingG: 94,  kcal: 16,  p: 1.2, c: 3,  f: 0.3 },
  { id: 'tomato',         name: 'Tomato',                        cat: 'veg',     serving: '1 medium (123g)',   servingG: 123, kcal: 22,  p: 1.1, c: 4.8,f: 0.2 },
  { id: 'cucumber',       name: 'Cucumber',                      cat: 'veg',     serving: '1 cup (104g)',      servingG: 104, kcal: 16,  p: 0.7, c: 3.8,f: 0.1 },
  { id: 'onion',          name: 'Onion',                         cat: 'veg',     serving: '1/2 cup (80g)',     servingG: 80,  kcal: 32,  p: 0.9, c: 7.5,f: 0.1 },
  { id: 'garlic',         name: 'Garlic',                        cat: 'veg',     serving: '1 clove (3g)',      servingG: 3,   kcal: 4,   p: 0.2, c: 1,  f: 0 },
  { id: 'mushrooms',      name: 'Mushrooms',                     cat: 'veg',     serving: '1 cup (70g)',       servingG: 70,  kcal: 15,  p: 2.2, c: 2.3,f: 0.2 },
  { id: 'corn',           name: 'Corn, kernels',                 cat: 'veg',     serving: '1 cup (145g)',      servingG: 145, kcal: 132, p: 5,   c: 29, f: 1.8 },
  { id: 'peas',           name: 'Green Peas',                    cat: 'veg',     serving: '1 cup (145g)',      servingG: 145, kcal: 118, p: 8,   c: 21, f: 0.6 },
  { id: 'kale',           name: 'Kale, raw',                     cat: 'veg',     serving: '1 cup (21g)',       servingG: 21,  kcal: 7,   p: 0.6, c: 1,  f: 0.3 },

  // Legumes
  { id: 'black-beans',    name: 'Black Beans, canned',           cat: 'protein', serving: '1/2 cup (86g)',     servingG: 86,  kcal: 120, p: 8,   c: 22, f: 0.5 },
  { id: 'chickpeas',      name: 'Chickpeas, canned',             cat: 'protein', serving: '1/2 cup (82g)',     servingG: 82,  kcal: 130, p: 7,   c: 22, f: 2 },
  { id: 'lentils',        name: 'Lentils, cooked',               cat: 'protein', serving: '1 cup (198g)',      servingG: 198, kcal: 230, p: 18,  c: 40, f: 0.8 },
  { id: 'kidney-beans',   name: 'Kidney Beans, canned',          cat: 'protein', serving: '1/2 cup (128g)',    servingG: 128, kcal: 108, p: 7,   c: 19, f: 0.4 },
  { id: 'edamame',        name: 'Edamame, shelled',              cat: 'protein', serving: '1 cup (155g)',      servingG: 155, kcal: 188, p: 18,  c: 14, f: 8 },
  { id: 'tofu-firm',      name: 'Tofu, firm',                    cat: 'protein', serving: '1/2 cup (126g)',    servingG: 126, kcal: 180, p: 20,  c: 5,  f: 11 },

  // Fats / oils / nuts
  { id: 'olive-oil',      name: 'Olive Oil',                     cat: 'fat',     serving: '1 tbsp (14g)',      servingG: 14,  kcal: 120, p: 0,   c: 0,  f: 14 },
  { id: 'coconut-oil',    name: 'Coconut Oil',                   cat: 'fat',     serving: '1 tbsp (14g)',      servingG: 14,  kcal: 120, p: 0,   c: 0,  f: 14 },
  { id: 'peanut-butter',  name: 'Peanut Butter',                 cat: 'fat',     serving: '2 tbsp (32g)',      servingG: 32,  kcal: 190, p: 8,   c: 7,  f: 16 },
  { id: 'almond-butter',  name: 'Almond Butter',                 cat: 'fat',     serving: '2 tbsp (32g)',      servingG: 32,  kcal: 200, p: 7,   c: 6,  f: 18 },
  { id: 'almonds',        name: 'Almonds',                       cat: 'fat',     serving: '1 oz (28g)',        servingG: 28,  kcal: 164, p: 6,   c: 6,  f: 14 },
  { id: 'walnuts',        name: 'Walnuts',                       cat: 'fat',     serving: '1 oz (28g)',        servingG: 28,  kcal: 185, p: 4.3, c: 4,  f: 18 },
  { id: 'cashews',        name: 'Cashews',                       cat: 'fat',     serving: '1 oz (28g)',        servingG: 28,  kcal: 157, p: 5.2, c: 9,  f: 12 },
  { id: 'chia-seeds',     name: 'Chia Seeds',                    cat: 'fat',     serving: '1 tbsp (12g)',      servingG: 12,  kcal: 60,  p: 2,   c: 5,  f: 4 },

  // Snacks / bars
  { id: 'protein-bar',    name: 'Protein Bar (typical)',         cat: 'snack',   serving: '1 bar',             servingG: 60,  kcal: 210, p: 20,  c: 22, f: 7 },
  { id: 'quest-bar',      name: 'Quest Bar',                     cat: 'snack',   serving: '1 bar (60g)',       servingG: 60,  kcal: 200, p: 21,  c: 22, f: 8 },
  { id: 'jerky',          name: 'Beef Jerky',                    cat: 'snack',   serving: '1 oz (28g)',        servingG: 28,  kcal: 82,  p: 13,  c: 3,  f: 2 },
  { id: 'trail-mix',      name: 'Trail Mix',                     cat: 'snack',   serving: '1/4 cup (35g)',     servingG: 35,  kcal: 170, p: 5,   c: 16, f: 11 },
  { id: 'popcorn',        name: 'Popcorn, air-popped',           cat: 'snack',   serving: '3 cups (24g)',      servingG: 24,  kcal: 95,  p: 3,   c: 19, f: 1 },
  { id: 'chips-tortilla', name: 'Tortilla Chips',                cat: 'snack',   serving: '1 oz (28g)',        servingG: 28,  kcal: 140, p: 2,   c: 19, f: 7 },
  { id: 'chips-potato',   name: 'Potato Chips',                  cat: 'snack',   serving: '1 oz (28g)',        servingG: 28,  kcal: 150, p: 2,   c: 15, f: 10 },
  { id: 'crackers',       name: 'Saltine Crackers',              cat: 'snack',   serving: '5 crackers',        servingG: 15,  kcal: 60,  p: 1.5, c: 11, f: 1.5 },
  { id: 'chocolate-dark', name: 'Dark Chocolate (70%)',          cat: 'snack',   serving: '1 oz (28g)',        servingG: 28,  kcal: 170, p: 2,   c: 13, f: 12 },

  // Sauces / condiments
  { id: 'honey',          name: 'Honey',                         cat: 'carb',    serving: '1 tbsp (21g)',      servingG: 21,  kcal: 64,  p: 0,   c: 17, f: 0 },
  { id: 'soy-sauce',      name: 'Soy Sauce',                     cat: 'snack',   serving: '1 tbsp (16g)',      servingG: 16,  kcal: 8,   p: 1.3, c: 0.8,f: 0 },
  { id: 'ketchup',        name: 'Ketchup',                       cat: 'snack',   serving: '1 tbsp (17g)',      servingG: 17,  kcal: 20,  p: 0,   c: 5,  f: 0 },
  { id: 'mayo',           name: 'Mayonnaise',                    cat: 'fat',     serving: '1 tbsp (14g)',      servingG: 14,  kcal: 90,  p: 0,   c: 0,  f: 10 },
  { id: 'salsa',          name: 'Salsa',                         cat: 'veg',     serving: '2 tbsp (30g)',      servingG: 30,  kcal: 10,  p: 0,   c: 2,  f: 0 },
  { id: 'sriracha',       name: 'Sriracha',                      cat: 'snack',   serving: '1 tsp (5g)',        servingG: 5,   kcal: 5,   p: 0,   c: 1,  f: 0 },
  { id: 'ranch',          name: 'Ranch Dressing',                cat: 'fat',     serving: '2 tbsp (30g)',      servingG: 30,  kcal: 140, p: 1,   c: 2,  f: 14 },
  { id: 'bbq-sauce',      name: 'BBQ Sauce',                     cat: 'snack',   serving: '2 tbsp (36g)',      servingG: 36,  kcal: 60,  p: 0,   c: 15, f: 0 },

  // Drinks
  { id: 'coffee-black',   name: 'Coffee, black',                 cat: 'drink',   serving: '1 cup (240ml)',     servingG: 240, kcal: 2,   p: 0.3, c: 0,  f: 0 },
  { id: 'orange-juice',   name: 'Orange Juice',                  cat: 'drink',   serving: '1 cup (248g)',      servingG: 248, kcal: 112, p: 1.7, c: 26, f: 0.5 },
  { id: 'gatorade',       name: 'Gatorade',                      cat: 'drink',   serving: '20 oz (591ml)',     servingG: 591, kcal: 140, p: 0,   c: 36, f: 0 },
  { id: 'beer',           name: 'Beer, regular',                 cat: 'drink',   serving: '12 oz (355ml)',     servingG: 355, kcal: 153, p: 1.6, c: 13, f: 0 },
  { id: 'wine-red',       name: 'Red Wine',                      cat: 'drink',   serving: '5 oz (148ml)',      servingG: 148, kcal: 125, p: 0,   c: 4,  f: 0 },
  { id: 'chocolate-milk', name: 'Chocolate Milk',                cat: 'drink',   serving: '1 cup (250ml)',     servingG: 250, kcal: 190, p: 8,   c: 30, f: 5 },
  { id: 'electrolyte',    name: 'Electrolyte Drink (packet)',    cat: 'drink',   serving: '1 packet',          servingG: 8,   kcal: 10,  p: 0,   c: 2,  f: 0 },

  // Meals (batch recipes from Plan D)
  { id: 'butter-chicken', name: 'Butter Chicken Bowl (batch)',   cat: 'meal',    serving: '1 serving',         servingG: 400, kcal: 540, p: 44,  c: 55, f: 15 },
  { id: 'salsa-chicken',  name: 'Salsa Chicken Bowl (batch)',    cat: 'meal',    serving: '1 serving',         servingG: 400, kcal: 560, p: 47,  c: 55, f: 16 },
  { id: 'beef-chili',     name: 'Beef Chili (batch)',            cat: 'meal',    serving: '1 serving',         servingG: 400, kcal: 550, p: 42,  c: 50, f: 18 },
  { id: 'fried-rice',     name: 'Chicken Fried Rice (skillet)',  cat: 'meal',    serving: '1 serving',         servingG: 380, kcal: 520, p: 43,  c: 55, f: 13 },
  { id: 'honey-garlic',   name: 'Honey Garlic Chicken',          cat: 'meal',    serving: '1 serving',         servingG: 380, kcal: 540, p: 42,  c: 50, f: 15 },
  { id: 'korean-beef',    name: 'Korean Beef Bowl',              cat: 'meal',    serving: '1 serving',         servingG: 380, kcal: 530, p: 40,  c: 48, f: 18 },
  { id: 'pork-carnitas',  name: 'Pork Carnitas (4oz cooked)',    cat: 'meal',    serving: '4 oz cooked',       servingG: 113, kcal: 280, p: 25,  c: 1,  f: 20 },
  { id: 'carnitas-bowl',  name: 'Pork Carnitas Bowl (rice + carnitas + salsa)', cat: 'meal', serving: '1 bowl', servingG: 500, kcal: 620, p: 32, c: 55, f: 28 },
  { id: 'yogurt-fruit-whey', name: 'Greek Yogurt + Frozen Fruit + Whey Scoop', cat: 'meal', serving: '1 bowl', servingG: 400, kcal: 340, p: 48, c: 30, f: 3 },
  { id: 'plan-d-breakfast', name: 'Plan D Breakfast (3 eggs + oats + banana + honey)', cat: 'meal', serving: '1 breakfast', servingG: 500, kcal: 550, p: 28, c: 85, f: 16 },
  { id: 'plan-d-evening', name: 'Plan D Evening Snack (yogurt + berries + granola)', cat: 'meal', serving: '1 snack', servingG: 300, kcal: 250, p: 22, c: 30, f: 5 },
];

export function searchFoods(q: string, limit = 25): Food[] {
  const query = q.trim().toLowerCase();
  const visible = FOODS.filter(f => !HIDDEN_FOOD_IDS.has(f.id));
  if (!query) return visible.slice(0, limit);
  const scored = visible.map(f => {
    const n = f.name.toLowerCase();
    let score = 0;
    if (n === query) score = 1000;
    else if (n.startsWith(query)) score = 500;
    else if (n.includes(query)) score = 200;
    else if (f.cat.includes(query)) score = 50;
    return { f, score };
  }).filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.f);
  return scored;
}
