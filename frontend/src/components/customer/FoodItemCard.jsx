import { useState } from 'react';
import { Minus, Plus, UtensilsCrossed } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { formatINR } from '../../utils/formatters';
import { VegIndicator } from '../common/Badge';

export default function FoodItemCard({ item, restaurant, showRestaurantName = false }) {
  const { addItem, updateQuantity, getItemQuantity } = useCart();
  const [imgError, setImgError] = useState(false);
  const qty = getItemQuantity(item.id);

  return (
    <div
      className={`flex gap-4 rounded-2xl border border-stone-200 bg-white p-4 transition ${
        item.availability ? 'hover:border-orange-200 hover:shadow-sm' : 'opacity-65'
      }`}
    >
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <VegIndicator isVeg={item.isVeg} />
            {item.bestseller && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                Bestseller
              </span>
            )}
            {!item.availability && (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                Sold Out
              </span>
            )}
          </div>

          <h4 className="mt-1.5 text-sm font-bold text-slate-900 sm:text-base">{item.name}</h4>
          {showRestaurantName && restaurant && (
            <p className="text-xs font-medium text-orange-600">{restaurant.name}</p>
          )}
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
            {item.description}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm font-extrabold text-slate-900 tabular-nums">
            {formatINR(item.price)}
          </span>
        </div>
      </div>

      <div className="flex w-28 shrink-0 flex-col items-center justify-between gap-2">
        <div className="h-24 w-28 overflow-hidden rounded-xl bg-stone-100">
          {!imgError ? (
            <img
              src={item.image}
              alt={item.name}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-stone-400">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
          )}
        </div>

        {qty > 0 ? (
          <div className="flex w-full items-center justify-between rounded-xl border border-orange-500 bg-orange-50 px-2 py-1 text-orange-700">
            <button
              type="button"
              onClick={() => updateQuantity(item.id, -1)}
              aria-label={`Decrease quantity of ${item.name}`}
              className="rounded p-0.5 hover:bg-orange-200/60"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-extrabold tabular-nums">{qty}</span>
            <button
              type="button"
              onClick={() => updateQuantity(item.id, 1)}
              aria-label={`Increase quantity of ${item.name}`}
              className="rounded p-0.5 hover:bg-orange-200/60"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!item.availability || !restaurant?.isOpen}
            onClick={() => addItem(item, restaurant)}
            className="w-full rounded-xl border border-orange-200 bg-white py-1.5 text-xs font-bold text-orange-600 shadow-xs transition hover:border-orange-600 hover:bg-orange-600 hover:text-white disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-slate-400 disabled:hover:bg-white"
          >
            {item.availability ? 'ADD +' : 'Unavailable'}
          </button>
        )}
      </div>
    </div>
  );
}
