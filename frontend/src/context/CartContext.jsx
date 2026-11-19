import { createContext, useContext, useMemo, useState } from 'react';
import { useToast } from './ToastContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState(null);

  const addItem = (foodItem, restaurantInfo) => {
    if (!foodItem.availability) {
      toast.error(`${foodItem.name} is currently sold out.`);
      return;
    }

    if (restaurant && restaurant.id !== restaurantInfo.id && items.length > 0) {
      setPendingSwitch({ foodItem, restaurantInfo });
      return;
    }

    setRestaurant(restaurantInfo);
    setItems((prev) => {
      const existing = prev.find((i) => i.id === foodItem.id);
      if (existing) {
        return prev.map((i) => (i.id === foodItem.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...foodItem, quantity: 1 }];
    });
    toast.success(`Added ${foodItem.name} to basket`);
  };

  const confirmRestaurantSwitch = () => {
    if (!pendingSwitch) return;
    const { foodItem, restaurantInfo } = pendingSwitch;
    setRestaurant(restaurantInfo);
    setItems([{ ...foodItem, quantity: 1 }]);
    setPendingSwitch(null);
    toast.success(`Started new basket from ${restaurantInfo.name}`);
  };

  const cancelRestaurantSwitch = () => setPendingSwitch(null);

  const updateQuantity = (foodItemId, delta) => {
    setItems((prev) => {
      const updated = prev
        .map((item) =>
          item.id === foodItemId ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0);
      if (updated.length === 0) setRestaurant(null);
      return updated;
    });
  };

  const removeItem = (foodItemId) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.id !== foodItemId);
      if (updated.length === 0) setRestaurant(null);
      return updated;
    });
  };

  const clearCart = () => {
    setItems([]);
    setRestaurant(null);
  };

  const getItemQuantity = (foodItemId) =>
    items.find((item) => item.id === foodItemId)?.quantity || 0;

  const totals = useMemo(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = itemsTotal === 0 ? 0 : itemsTotal >= 399 ? 0 : 25;
    const taxAmount = Math.round(itemsTotal * 0.05);
    const totalAmount = itemsTotal + deliveryFee + taxAmount;
    return { itemCount, itemsTotal, deliveryFee, taxAmount, totalAmount };
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        restaurant,
        totals,
        isDrawerOpen,
        openDrawer: () => setIsDrawerOpen(true),
        closeDrawer: () => setIsDrawerOpen(false),
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        getItemQuantity,
        pendingSwitch,
        confirmRestaurantSwitch,
        cancelRestaurantSwitch,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
