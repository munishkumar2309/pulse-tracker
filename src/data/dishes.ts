// Common Indian dishes, per typical serving. ESTIMATES for standard home/restaurant recipes;
// real values vary with oil, ghee and portion. Shown in the app with an "Estimate" label.
// Ingredients (rice, atta, dal, milk, fruit…) come from IFCT 2017 instead (src/data/ifct.json).
// Columns: name, aliases, unit, grams per unit, kcal, protein g, carbs g, fat g (all per ONE unit).

type Row = [name: string, aliases: string, unit: string, grams: number, kcal: number, p: number, c: number, f: number]

const ROWS: Row[] = [
  // Breads
  ['Roti / chapati', 'phulka fulka rotli', 'piece', 40, 110, 3.5, 20, 2.5],
  ['Phulka (no ghee)', 'roti plain', 'piece', 30, 85, 3, 17, 0.5],
  ['Paratha, plain', 'parantha', 'piece', 80, 260, 5.5, 34, 11],
  ['Aloo paratha', 'potato parantha', 'piece', 120, 300, 6.5, 42, 12],
  ['Paneer paratha', 'parantha', 'piece', 120, 330, 11, 38, 15],
  ['Puri', 'poori', 'piece', 25, 100, 1.8, 11, 5.5],
  ['Naan', 'nan', 'piece', 90, 260, 8, 45, 5],
  ['Butter naan', 'nan', 'piece', 100, 320, 8.5, 46, 11],
  ['Bhatura', 'bhature', 'piece', 80, 290, 6, 36, 13],
  ['Thepla', 'methi thepla', 'piece', 40, 120, 3, 16, 5],
  ['Bread slice, white', 'pav toast', 'slice', 25, 67, 2.2, 12.5, 0.8],
  ['Pav', 'bun ladi pav', 'piece', 40, 110, 3.5, 20, 1.8],
  // Rice
  ['Steamed rice', 'chawal plain rice', 'katori', 150, 195, 4, 42, 0.5],
  ['Jeera rice', 'cumin rice', 'katori', 150, 240, 4.5, 43, 5.5],
  ['Veg pulao', 'pulav', 'plate', 200, 300, 6, 50, 8],
  ['Veg biryani', 'biriyani', 'plate', 250, 400, 9, 60, 13],
  ['Chicken biryani', 'biriyani', 'plate', 300, 520, 25, 60, 19],
  ['Mutton biryani', 'biriyani gosht', 'plate', 300, 580, 26, 58, 26],
  ['Curd rice', 'dahi chawal thayir sadam', 'plate', 200, 260, 7, 40, 7],
  ['Lemon rice', 'chitranna', 'plate', 200, 320, 5, 52, 10],
  ['Khichdi', 'khichri', 'katori', 200, 240, 8.5, 38, 6],
  ['Rajma chawal', 'rajma rice', 'plate', 350, 450, 15, 72, 10],
  // Dals & curries
  ['Dal tadka (toor)', 'arhar dal yellow dal', 'katori', 150, 160, 9, 22, 4.5],
  ['Moong dal', 'dal', 'katori', 150, 140, 9, 20, 3],
  ['Dal makhani', 'kali dal', 'katori', 150, 260, 10, 24, 14],
  ['Rajma', 'kidney beans curry', 'katori', 150, 210, 10, 28, 6.5],
  ['Chole', 'chana masala chickpea curry', 'katori', 150, 240, 10, 30, 9],
  ['Sambar', 'sambhar', 'katori', 150, 120, 5, 16, 4],
  ['Rasam', 'saaru', 'katori', 150, 50, 1.5, 8, 1.5],
  ['Kadhi', 'kadhi pakora', 'katori', 150, 150, 5, 12, 9],
  ['Palak paneer', 'saag paneer', 'katori', 150, 270, 12, 9, 21],
  ['Paneer butter masala', 'paneer makhani', 'katori', 150, 350, 13, 12, 28],
  ['Matar paneer', 'mutter paneer', 'katori', 150, 260, 11, 13, 18],
  ['Aloo gobi', 'gobhi', 'katori', 150, 150, 3.5, 17, 8],
  ['Bhindi masala', 'okra bhindi fry', 'katori', 150, 160, 3, 14, 11],
  ['Mixed veg sabzi', 'mix veg', 'katori', 150, 140, 4, 15, 7.5],
  ['Aloo sabzi', 'potato sabzi aloo bhaji', 'katori', 150, 190, 3, 25, 9],
  ['Baingan bharta', 'brinjal', 'katori', 150, 140, 3, 12, 9],
  ['Lauki sabzi', 'bottle gourd doodhi', 'katori', 150, 80, 1.5, 8, 4.5],
  ['Cabbage sabzi', 'patta gobhi poriyal', 'katori', 150, 100, 2.5, 9, 6],
  // Non-veg
  ['Chicken curry', 'murgh', 'katori', 200, 330, 30, 8, 20],
  ['Butter chicken', 'murgh makhani', 'katori', 200, 440, 30, 12, 30],
  ['Chicken tikka', 'tandoori tikka', 'plate (6 pcs)', 150, 240, 36, 5, 8],
  ['Tandoori chicken', 'tandoori', 'quarter', 150, 260, 38, 4, 10],
  ['Mutton curry', 'gosht rogan josh', 'katori', 200, 420, 30, 7, 30],
  ['Fish curry', 'machli', 'katori', 200, 260, 26, 8, 14],
  ['Fish fry', 'machli fry', 'piece', 100, 220, 20, 8, 12],
  ['Egg curry (2 eggs)', 'anda curry', 'katori', 200, 280, 15, 10, 20],
  ['Boiled egg', 'anda ubla', 'piece', 50, 78, 6.3, 0.6, 5.3],
  ['Omelette (2 eggs)', 'anda omelet', 'piece', 120, 200, 13, 2, 15],
  ['Egg bhurji (2 eggs)', 'anda bhurji scrambled', 'plate', 120, 220, 13, 4, 17],
  // South Indian & breakfast
  ['Idli', 'idly', 'piece', 40, 58, 2, 12, 0.2],
  ['Plain dosa', 'dosai', 'piece', 80, 170, 4, 28, 5],
  ['Masala dosa', 'dosai', 'piece', 180, 380, 7.5, 55, 15],
  ['Medu vada', 'vada wada', 'piece', 40, 110, 3.5, 11, 6],
  ['Uttapam', 'uthappam', 'piece', 130, 250, 6.5, 40, 7],
  ['Upma', 'uppittu rava', 'katori', 150, 210, 5, 30, 8],
  ['Pongal', 'ven pongal', 'katori', 150, 230, 6, 32, 9],
  ['Coconut chutney', 'nariyal chutney', '2 tbsp', 40, 90, 1.2, 3.5, 8],
  ['Poha', 'pohe aval', 'plate', 150, 250, 5, 40, 8],
  ['Besan chilla', 'cheela', 'piece', 70, 140, 7, 15, 6],
  ['Moong dal chilla', 'cheela pesarattu', 'piece', 70, 120, 7, 15, 3.5],
  ['Oats porridge with milk', 'oatmeal', 'bowl', 250, 250, 10, 35, 7],
  // Snacks & street food
  ['Samosa', 'samosa', 'piece', 60, 260, 4, 26, 16],
  ['Kachori', 'kachauri', 'piece', 60, 280, 5, 27, 17],
  ['Pakora', 'bhajia pakoda bhaji', '4 pieces', 60, 180, 4, 16, 11],
  ['Pav bhaji', 'pavbhaji', 'plate', 300, 520, 12, 70, 22],
  ['Vada pav', 'wada pav', 'piece', 130, 300, 6.5, 40, 13],
  ['Pani puri', 'golgappa puchka', '6 pieces', 120, 180, 3.5, 30, 6],
  ['Bhel puri', 'bhelpuri', 'plate', 150, 260, 6, 40, 9],
  ['Dhokla', 'khaman', '4 pieces', 100, 160, 6, 24, 4.5],
  ['Masala Maggi', 'maggi noodles instant', 'pack', 70, 310, 7, 44, 12],
  ['Veg sandwich', 'sandwich', 'piece', 150, 270, 8, 38, 10],
  ['Veg momos', 'momo dumplings', '6 pieces', 150, 240, 7, 40, 5],
  ['Chicken momos', 'momo dumplings', '6 pieces', 150, 280, 15, 34, 9],
  ['Pizza slice, margherita', 'pizza', 'slice', 100, 270, 11, 33, 10],
  ['Veg burger', 'aloo tikki burger', 'piece', 150, 350, 9, 45, 15],
  ['French fries', 'fries chips', 'medium', 110, 340, 4, 44, 17],
  ['Roasted chana', 'bhuna chana', 'handful', 30, 110, 6.5, 17, 1.6],
  ['Roasted makhana', 'fox nuts lotus seeds', 'bowl', 25, 100, 2.5, 19, 1.5],
  ['Peanut chikki', 'gajak', 'piece', 25, 120, 3.5, 13, 6.5],
  ['Sprouts salad', 'moong sprouts', 'katori', 100, 100, 7, 15, 1],
  ['Green salad', 'kachumber salad', 'katori', 100, 25, 1, 5, 0.2],
  // Dairy & drinks
  ['Curd / dahi', 'yogurt curd', 'katori', 150, 90, 5, 7, 4.5],
  ['Raita', 'boondi raita', 'katori', 150, 100, 4.5, 8, 5],
  ['Sweet lassi', 'lassi', 'glass', 250, 230, 7, 36, 6],
  ['Chaas / buttermilk', 'mattha majjige', 'glass', 250, 45, 2.5, 4, 2],
  ['Milk, toned', 'doodh', 'glass', 250, 145, 7.5, 12, 7.5],
  ['Chai with milk and sugar', 'tea', 'cup', 150, 90, 2.5, 13, 3],
  ['Coffee with milk and sugar', 'filter coffee', 'cup', 150, 95, 3, 13, 3.5],
  ['Fresh lime soda, sweet', 'nimbu soda', 'glass', 250, 90, 0, 23, 0],
  ['Coconut water', 'nariyal pani', 'glass', 250, 48, 1.8, 9, 0.5],
  ['Cola', 'soft drink', 'can', 330, 140, 0, 35, 0],
  ['Beer', 'beer', 'can', 330, 150, 1.5, 13, 0],
  // Sweets
  ['Gulab jamun', 'gulabjamun', 'piece', 40, 150, 2, 22, 6],
  ['Rasgulla', 'rosogolla', 'piece', 40, 105, 2, 22, 1.5],
  ['Jalebi', 'jilebi', '2 pieces', 50, 200, 1.5, 30, 8.5],
  ['Kheer', 'payasam rice pudding', 'katori', 150, 230, 6, 32, 8.5],
  ['Sooji halwa', 'sheera rava kesari', 'katori', 100, 330, 4, 45, 15],
  ['Besan ladoo', 'laddu', 'piece', 40, 190, 3.5, 20, 11],
  ['Kaju katli', 'kaju barfi', 'piece', 15, 70, 1.5, 8, 3.5],
]

export interface DishFood {
  id: string
  name: string
  aliases: string
  group: string
  unit: string
  unitGrams: number
  kcal: number
  p: number
  c: number
  f: number
  estimate: true
}

/** Converted to per-100 g so dishes and IFCT foods share one shape. */
export const DISHES: DishFood[] = ROWS.map(([name, aliases, unit, grams, kcal, p, c, f]) => {
  const k = 100 / grams
  const r = (n: number) => Math.round(n * k * 10) / 10
  return {
    id: 'dish:' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name, aliases, group: 'Dishes', unit, unitGrams: grams,
    kcal: Math.round(kcal * k), p: r(p), c: r(c), f: r(f), estimate: true,
  }
})
