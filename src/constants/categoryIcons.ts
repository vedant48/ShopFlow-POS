export interface CategoryIconOption {
  key: string;
  emoji: string;
  label: string;
}

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { key: 'cigarette', emoji: '🚬', label: 'Cigarettes / Tobacco' },
  { key: 'drink', emoji: '🥤', label: 'Cold Drinks / Beverages' },
  { key: 'gutka', emoji: '🧃', label: 'Gutka / Paan Masala' },
  { key: 'chocolate', emoji: '🍫', label: 'Chocolates / Sweets' },
  { key: 'snacks', emoji: '🍟', label: 'Chips / Snacks' },
  { key: 'water', emoji: '💧', label: 'Water Bottles' },
  { key: 'package', emoji: '📦', label: 'Others / General' },
  { key: 'cart', emoji: '🛒', label: 'Groceries / Provisions' },
  { key: 'icecream', emoji: '🍦', label: 'Ice Cream' },
  { key: 'coffee', emoji: '☕', label: 'Tea / Coffee' },
  { key: 'burger', emoji: '🍔', label: 'Fast Food' },
  { key: 'biscuit', emoji: '🍪', label: 'Biscuits / Bakery' },
  { key: 'milk', emoji: '🥛', label: 'Dairy / Milk' },
  { key: 'leaf', emoji: '🍃', label: 'Paan / Herbs' },
  { key: 'soap', emoji: '🧼', label: 'Personal Care' },
  { key: 'fruits', emoji: '🍎', label: 'Fruits' },
  { key: 'medicine', emoji: '💊', label: 'Medicine / Pharma' },
];

export const DEFAULT_CATEGORY_SEEDS = [
  { name: 'Cigarettes', icon: 'cigarette', sortOrder: 1 },
  { name: 'Cold Drinks', icon: 'drink', sortOrder: 2 },
  { name: 'Gutka', icon: 'gutka', sortOrder: 3 },
  { name: 'Chocolate', icon: 'chocolate', sortOrder: 4 },
  { name: 'Snacks', icon: 'snacks', sortOrder: 5 },
  { name: 'Others', icon: 'package', sortOrder: 6 },
];

const ICON_MAP: Record<string, string> = {
  cigarette: '🚬',
  drink: '🥤',
  beverage: '🥤',
  gutka: '🧃',
  chocolate: '🍫',
  candy: '🍬',
  snacks: '🍟',
  food: '🍟',
  water: '💧',
  package: '📦',
  others: '📦',
  cart: '🛒',
  icecream: '🍦',
  coffee: '☕',
  burger: '🍔',
  biscuit: '🍪',
  milk: '🥛',
  leaf: '🍃',
  soap: '🧼',
  fruits: '🍎',
  medicine: '💊',
};

/**
 * Returns the display emoji for a category icon key.
 * If the input is already an emoji or unrecognized key, it gracefully handles it.
 */
export function getCategoryEmoji(iconKey?: string | null): string {
  if (!iconKey) return '📦';
  const trimmed = iconKey.trim();
  // If stored directly as an emoji, return it
  if (/\p{Extended_Pictographic}/u.test(trimmed)) {
    return trimmed;
  }
  const normalizedKey = trimmed.toLowerCase();
  return ICON_MAP[normalizedKey] || '📦';
}
