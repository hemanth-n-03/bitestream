import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, Star, Utensils } from 'lucide-react';
import { estimateDeliveryMinutes } from '../../utils/geo';
import { formatDistanceKm, formatINR } from '../../utils/formatters';

export default function RestaurantCard({ restaurant, distanceKm }) {
  const [imgError, setImgError] = useState(false);

  return (
    <Link
      to={`/restaurant/${restaurant.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg"
    >
      <div className="relative h-48 w-full overflow-hidden bg-stone-200">
        {!imgError ? (
          <img
            src={restaurant.image}
            alt={restaurant.name}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 to-amber-50 text-orange-500">
            <Utensils className="h-10 w-10" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/75 to-transparent" />

        {restaurant.featuredTag && (
          <span className="absolute top-3 left-3 rounded-lg bg-slate-950/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-xs">
            {restaurant.featuredTag}
          </span>
        )}

        {restaurant.isVegOnly && (
          <span className="absolute top-3 right-3 rounded-lg bg-emerald-600/95 px-2.5 py-1 text-[11px] font-bold text-white">
            Pure Veg
          </span>
        )}

        <div className="absolute right-3 bottom-3 left-3 flex items-center justify-between text-xs font-semibold text-white">
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 backdrop-blur-xs">
            <Clock className="h-3.5 w-3.5 text-orange-300" />
            {estimateDeliveryMinutes(distanceKm, restaurant.prepTimeMins)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 backdrop-blur-xs tabular-nums">
            <MapPin className="h-3.5 w-3.5 text-emerald-300" />
            {formatDistanceKm(distanceKm)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900 group-hover:text-orange-600">
              {restaurant.name}
            </h3>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white tabular-nums">
              {restaurant.rating.average.toFixed(1)}
              <Star className="h-3 w-3 fill-current" />
            </span>
          </div>

          <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-500">
            {restaurant.cuisines.join(' • ')}
          </p>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
            {restaurant.description}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs text-slate-500">
          <span className="truncate">{restaurant.area}, Mysuru</span>
          <span className="shrink-0 font-semibold text-slate-700 tabular-nums">
            {formatINR(restaurant.priceForTwo)} for two
          </span>
        </div>
      </div>
    </Link>
  );
}
