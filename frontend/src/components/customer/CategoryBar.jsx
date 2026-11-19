const CATEGORY_EMOJI_MAP = {
  All: '🍽️',
  'South Indian': '🥞',
  Biryani: '🍚',
  'North Indian': '🍛',
  Bowls: '🥗',
  'Street Food': '🥟',
  Desserts: '🍨',
  Beverages: '☕',
};

const DEFAULT_CATEGORIES = [
  'South Indian',
  'Biryani',
  'North Indian',
  'Bowls',
  'Street Food',
  'Desserts',
  'Beverages',
];

export default function CategoryBar({
  categories = [],
  selectedCategory,
  onSelectCategory,
  vegOnly,
  onToggleVeg,
  sortBy,
  onChangeSort,
}) {
  const names = categories.length > 0 ? categories.map((c) => c.name || c) : DEFAULT_CATEGORIES;
  const pillList = [{ id: 'All', label: 'All Cuisines', emoji: CATEGORY_EMOJI_MAP.All }];

  names.forEach((name) => {
    if (name !== 'All') {
      pillList.push({
        id: name,
        label: name,
        emoji: CATEGORY_EMOJI_MAP[name] || '🍴',
      });
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
        {pillList.map((cat) => {
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                active
                  ? 'border-orange-600 bg-orange-600 text-white shadow-sm shadow-orange-600/20'
                  : 'border-stone-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50/40'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleVeg}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition ${
              vegOnly
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                : 'border-stone-200 bg-white text-slate-700 hover:bg-stone-50'
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            Pure Veg Only
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-slate-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => onChangeSort(e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 font-semibold text-slate-700 outline-none focus:border-orange-500"
          >
            <option value="distance">Nearest First (2dsphere)</option>
            <option value="rating">Top Rated</option>
            <option value="fast">Fastest Delivery</option>
          </select>
        </div>
      </div>
    </div>
  );
}
