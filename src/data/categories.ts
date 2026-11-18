// Spend categories and merchant keyword map. Documented in docs/MONEY.md.
// Keywords are matched against the normalised merchant name and then the raw SMS text (lowercase, word-ish).

export interface CategoryDef {
  name: string
  color: string // chart colour token (CSS var name suffix)
  icon: string // emoji used in lists
  keywords: string[]
  excluded?: boolean // not counted as spending (transfers, card bill payments)
  income?: boolean
  matchFirst?: boolean // tried before other categories, so "NACH … mutual fund" is not taken by EMI's "nach"
}

export const CATEGORIES: CategoryDef[] = [
  { name: 'Food Delivery', color: 'c1', icon: '🛵', keywords: ['swiggy', 'zomato', 'eatsure', 'dominos', 'faasos', 'box8', 'eatclub'] },
  { name: 'Food & Dining', color: 'c2', icon: '🍽️', keywords: ['restaurant', 'cafe', 'starbucks', 'mcdonald', 'kfc', 'burger king', 'pizza hut', 'haldiram', 'chaayos', 'third wave', 'blue tokai', 'barbeque', 'dhaba', 'bakery', 'sweets', 'chai', 'tea stall', 'juice', 'canteen', 'food court', 'subway', 'wow momo', 'biryani', 'mithai', 'sweet shop'] },
  { name: 'Groceries', color: 'c3', icon: '🛒', keywords: ['bigbasket', 'blinkit', 'zepto', 'instamart', 'dmart', 'avenue supermarts', 'reliance fresh', 'jiomart', 'more retail', 'spencer', 'nature basket', 'grofers', 'kirana', 'milkbasket', 'country delight', 'supermarket', 'mart', 'provision', 'provisions', 'vegetables', 'fruits', 'dairy', 'milk', 'big bazaar', 'star bazaar', 'ratnadeep', 'licious', 'freshtohome'] },
  { name: 'Transport', color: 'c4', icon: '🚕', keywords: ['uber', 'ola', 'rapido', 'metro', 'dmrc', 'irctc', 'redbus', 'fastag', 'parking', 'namma yatri', 'blusmart', 'cab', 'toll', 'nhai', 'yulu', 'indrive', 'ksrtc', 'msrtc', 'bmtc'] },
  { name: 'Fuel', color: 'c5', icon: '⛽', keywords: ['petrol', 'fuel', 'indian oil', 'iocl', 'hpcl', 'bpcl', 'bharat petroleum', 'hindustan petroleum', 'shell', 'nayara', 'filling station', 'service station', 'fuels', 'petroleum'] },
  { name: 'Shopping', color: 'c6', icon: '🛍️', keywords: ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'tata cliq', 'croma', 'reliance digital', 'decathlon', 'ikea', 'lifestyle', 'westside', 'zara', 'h&m', 'uniqlo', 'pantaloons', 'lenskart', 'firstcry', 'pepperfry', 'max fashion', 'trends', 'vijay sales', 'bata', 'nike', 'adidas', 'puma'] },
  { name: 'Bills & Utilities', color: 'c7', icon: '💡', keywords: ['electricity', 'bescom', 'tata power', 'adani electricity', 'bses', 'msedcl', 'airtel', 'jio', 'vodafone', 'vi ', 'bsnl', 'act fibernet', 'broadband', 'gas', 'indane', 'water bill', 'dth', 'tata play', 'recharge', 'bbps', 'billdesk', 'insurance', 'policybazaar', 'postpaid', 'prepaid', 'mahanagar gas', 'piped gas', 'tneb', 'mseb', 'water board', 'municipal', 'property tax'] },
  { name: 'Rent', color: 'c8', icon: '🏠', keywords: ['rent', 'nobroker', 'housing.com', 'landlord', 'maintenance'] },
  { name: 'EMI & Loans', color: 'c9', icon: '🏦', keywords: ['emi', 'loan', 'bajaj finance', 'bajaj finserv', 'home credit', 'nach', 'ecs'] },
  {
    name: 'Investments', color: 'c10', icon: '📈', matchFirst: true,
    keywords: [
      // platforms and brokers
      'groww', 'zerodha', 'upstox', 'kuvera', 'coin', 'smallcase', 'indmoney', 'paytm money', 'bajaj capital', 'angel one', 'icici direct',
      'hdfc sec', 'hdfc securities', 'kotak securities', 'motilal oswal', 'sharekhan', '5paisa', 'fyers', 'et money', 'etmoney', 'scripbox', 'fisdom',
      // stocks: exchanges, clearing corporations, depositories
      'nse', 'bse', 'iccl', 'indian clearing', 'nsccl', 'nse clearing', 'cdsl', 'nsdl', 'demat',
      // mutual funds: SIPs, registrars, fund houses
      'mutual fund', 'mf', 'sip', 'bse star', 'mf utilities', 'cams', 'camsonline', 'kfintech', 'kfin', 'karvy', 'asset management',
      'sbimf', 'hdfcmf', 'nippon india', 'parag parikh', 'ppfas', 'mirae asset',
      // deposits and small savings
      'fd', 'fixed deposit', 'term deposit', 'recurring deposit', 'rd instalment', 'rd installment', 'stable money',
      'nps', 'ppf', 'sukanya', 'nsc', 'kisan vikas', 'wint wealth', 'grip invest', 'goldenpi',
      // gold
      'digital gold', 'gold bond', 'sovereign gold', 'sgb', 'gold etf', 'safegold', 'augmont', 'mmtc', 'bullion',
      'tanishq', 'kalyan jewellers', 'malabar gold', 'joyalukkas', 'jewellers', 'jewellery',
    ],
  },
  { name: 'Health', color: 'c11', icon: '💊', keywords: ['pharmacy', 'apollo', 'medplus', 'netmeds', '1mg', 'pharmeasy', 'hospital', 'clinic', 'diagnostic', 'practo', 'cult', 'cultfit', 'gym', 'healthify', 'medical', 'medicals', 'chemist', 'medicos', 'pathology', 'dental', 'fortis', 'manipal', 'max healthcare', 'tata 1mg'] },
  { name: 'Entertainment', color: 'c12', icon: '🎬', keywords: ['bookmyshow', 'pvr', 'inox', 'cinepolis', 'district', 'paytm insider', 'steam', 'playstation', 'gaming', 'dream11'] },
  { name: 'Subscriptions', color: 'c13', icon: '🔁', keywords: ['netflix', 'spotify', 'hotstar', 'jiohotstar', 'prime video', 'youtube premium', 'google play', 'apple.com', 'icloud', 'sonyliv', 'zee5', 'linkedin', 'openai', 'claude', 'anthropic', 'microsoft'] },
  { name: 'Travel', color: 'c14', icon: '✈️', keywords: ['makemytrip', 'goibibo', 'cleartrip', 'yatra', 'indigo', 'air india', 'vistara', 'akasa', 'spicejet', 'oyo', 'airbnb', 'booking.com', 'agoda', 'ixigo', 'easemytrip', 'abhibus', 'confirmtkt', 'resort'] },
  { name: 'Education', color: 'c15', icon: '📚', keywords: ['school', 'college', 'university', 'udemy', 'coursera', 'byju', 'unacademy', 'fees', 'tuition', 'academy', 'institute', 'books'] },
  { name: 'Cash', color: 'c16', icon: '💵', keywords: ['atm', 'cash withdrawal'] },
  { name: 'Transfers', color: 'c17', icon: '🔄', keywords: ['self transfer', 'own account', 'credit card payment', 'cc payment', 'card bill', 'cred club', 'cred ', 'towards your card', 'towards your credit card'], excluded: true },
  { name: 'Income', color: 'c18', icon: '💰', keywords: ['salary', 'sal ', 'interest', 'dividend', 'refund', 'cashback', 'reversal'], income: true },
  { name: 'Other', color: 'c19', icon: '•', keywords: [] },
]

export const CATEGORY_BY_NAME = Object.fromEntries(CATEGORIES.map((c) => [c.name, c]))
export const EXCLUDED_CATEGORIES = new Set(CATEGORIES.filter((c) => c.excluded).map((c) => c.name))
