import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  dishId: string;
  dishName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface CartState {
  items: CartItem[];
  businessId: string | null;

  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (dishId: string) => void;
  updateQuantity: (dishId: string, quantity: number) => void;
  clearCart: () => void;
  setBusinessId: (id: string) => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      businessId: null,

      addItem: (item) => {
        const existingItem = get().items.find((i) => i.dishId === item.dishId);

        if (existingItem) {
          set({
            items: get().items.map((i) =>
              i.dishId === item.dishId
                ? { ...i, quantity: i.quantity + 1 }
                : i
            ),
          });
        } else {
          set({
            items: [...get().items, { ...item, quantity: 1 }],
          });
        }
      },

      removeItem: (dishId) => {
        set({
          items: get().items.filter((i) => i.dishId !== dishId),
        });
      },

      updateQuantity: (dishId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(dishId);
        } else {
          set({
            items: get().items.map((i) =>
              i.dishId === dishId ? { ...i, quantity } : i
            ),
          });
        }
      },

      clearCart: () => {
        set({ items: [], businessId: null });
      },

      setBusinessId: (id) => {
        // Clear cart if switching to a different business
        if (get().businessId && get().businessId !== id) {
          set({ items: [], businessId: id });
        } else {
          set({ businessId: id });
        }
      },

      getTotal: () => {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        );
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
