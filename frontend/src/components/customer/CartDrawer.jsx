import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Banknote, Loader2, MapPin, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useLocationContext } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { createOrderApi } from '../../api/orderApi';
import { formatINR } from '../../utils/formatters';
import { VegIndicator } from '../common/Badge';
import Modal from '../common/Modal';

export default function CartDrawer() {
  const {
    items,
    restaurant,
    totals,
    isDrawerOpen,
    closeDrawer,
    updateQuantity,
    removeItem,
    clearCart,
    pendingSwitch,
    confirmRestaurantSwitch,
    cancelRestaurantSwitch,
  } = useCart();
  const { selectedZone, customLandmark } = useLocationContext();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [placingOrder, setPlacingOrder] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // Regenerate idempotency key when basket items or restaurant change
  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, [items, restaurant?.id]);

  const handleCheckout = async () => {
    if (!restaurant || items.length === 0 || placingOrder) return;

    if (!isAuthenticated) {
      closeDrawer();
      toast.info('Please sign in as a customer to place your order.');
      navigate('/login', { state: { email: 'ananya@bitestream.dev', from: '/' } });
      return;
    }

    if (user?.role !== 'customer') {
      toast.error('Switch to a Customer account to place orders.');
      return;
    }

    setPlacingOrder(true);
    try {
      const result = await createOrderApi(
        {
          restaurantId: restaurant.id || restaurant._id,
          items: items.map((i) => ({
            foodItemId: i.id || i._id,
            quantity: i.quantity,
          })),
          deliveryAddress: {
            label: selectedZone.label,
            street: customLandmark
              ? `${customLandmark}, ${selectedZone.address}`
              : selectedZone.address,
            area: selectedZone.label,
            city: 'Mysuru',
          },
          deliveryLocation: {
            type: 'Point',
            coordinates: selectedZone.coordinates,
          },
          paymentMethod: 'COD',
          idempotencyKey,
        },
        idempotencyKey
      );

      clearCart();
      closeDrawer();
      toast.success(
        `Order ${result.order.orderNumber} placed (${formatINR(result.order.totalAmount)} COD)!`
      );
      navigate('/orders');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to place order. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={Boolean(pendingSwitch)}
        onClose={cancelRestaurantSwitch}
        title="Replace items in basket?"
      >
        <p className="text-sm text-slate-600">
          Your basket currently contains items from{' '}
          <span className="font-semibold text-slate-900">{restaurant?.name}</span>. Would you
          like to clear it and add items from{' '}
          <span className="font-semibold text-slate-900">
            {pendingSwitch?.restaurantInfo?.name}
          </span>
          ?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={cancelRestaurantSwitch}
            className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-stone-50"
          >
            Keep Existing
          </button>
          <button
            type="button"
            onClick={confirmRestaurantSwitch}
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Start Fresh
          </button>
        </div>
      </Modal>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
          <div className="flex-1" onClick={closeDrawer} />
          <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-slide-in-right">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="h-5 w-5 text-orange-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">Your Basket</h2>
                  {restaurant && (
                    <p className="text-xs font-medium text-slate-500">{restaurant.name}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close basket"
                className="rounded-xl p-1.5 text-slate-400 hover:bg-stone-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                    <ShoppingBag className="h-8 w-8" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900">Your basket is empty</h3>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                    Explore Mysuru kitchens near {selectedZone.label} and add dishes to begin.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Delivery Address Banner */}
                  <div className="flex items-start gap-2.5 rounded-xl border border-orange-200 bg-orange-50/70 p-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">Delivering to {selectedZone.label}</p>
                      <p className="text-slate-600">
                        {customLandmark ? `${customLandmark}, ` : ''}
                        {selectedZone.address}
                      </p>
                    </div>
                  </div>

                  {/* Cash on Delivery Notice */}
                  <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-slate-700">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                    <span>
                      Payment Mode: <strong>Cash on Delivery (COD)</strong>
                    </span>
                  </div>

                  {/* Free Delivery Meter */}
                  {totals.itemsTotal < 399 ? (
                    <div className="rounded-xl bg-stone-100 px-3 py-2 text-xs text-slate-600">
                      Add <span className="font-bold text-orange-600">{formatINR(399 - totals.itemsTotal)}</span>{' '}
                      more for <span className="font-semibold">FREE delivery</span>.
                    </div>
                  ) : (
                    <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                      Free delivery unlocked on this order!
                    </div>
                  )}

                  {/* Line Items */}
                  <div className="divide-y divide-stone-100">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <div className="mt-1">
                            <VegIndicator isVeg={item.isVeg} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {item.name}
                            </p>
                            <p className="text-xs text-slate-500 tabular-nums">
                              {formatINR(item.price)} each
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50 px-1 py-0.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="rounded p-1 text-slate-600 hover:bg-white"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="min-w-6 text-center text-xs font-bold tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              className="rounded p-1 text-slate-600 hover:bg-white"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="w-14 text-right text-xs font-bold text-slate-900 tabular-nums">
                            {formatINR(item.price * item.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.name}`}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Clear entire basket
                  </button>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-stone-200 bg-stone-50 px-5 py-4">
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Item Subtotal</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {formatINR(totals.itemsTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Fee</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {totals.deliveryFee === 0 ? 'FREE' : formatINR(totals.deliveryFee)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxes &amp; Charges (5%)</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {formatINR(totals.taxAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-stone-200 pt-2 text-sm font-extrabold text-slate-900">
                    <span>To Pay (COD)</span>
                    <span className="tabular-nums">{formatINR(totals.totalAmount)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={placingOrder}
                  onClick={handleCheckout}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/25 transition hover:bg-orange-700 disabled:opacity-60"
                >
                  {placingOrder ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {placingOrder
                    ? 'Confirming Order...'
                    : !isAuthenticated
                    ? `Sign In to Place Order • ${formatINR(totals.totalAmount)}`
                    : `Place COD Order • ${formatINR(totals.totalAmount)}`}
                  {!placingOrder && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
