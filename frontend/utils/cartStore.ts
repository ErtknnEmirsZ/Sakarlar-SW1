import { create } from 'zustand';

export interface CartProduct {
  id: string;
  product_name: string;
  barcode: string;
  price: number;
  category: string;
  stock_quantity?: number | null;
  quantity_type?: string;
  box_quantity?: number;
  is_weight_based?: boolean;
}

export interface CartItem {
  cartId: string;          // unique per row
  product: CartProduct;
  quantity: number;        // adet count OR kg amount
}

interface CartStore {
  items: CartItem[];
  addItem: (product: CartProduct, quantity?: number) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  removeItem: (cartId: string) => void;
  clearCart: () => void;
  totalAmount: () => number;
  totalCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (product, quantity = 1) => {
    set((state) => {
      // Weight-based: always add as new row
      if (product.is_weight_based) {
        return {
          items: [
            ...state.items,
            { cartId: `${product.id}_${Date.now()}`, product, quantity },
          ],
        };
      }
      // Unit-based: merge if same product already in cart
      const existing = state.items.find((i) => i.product.id === product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + quantity }
              : i
          ),
        };
      }
      return {
        items: [
          ...state.items,
          { cartId: `${product.id}_${Date.now()}`, product, quantity },
        ],
      };
    });
  },

  updateQuantity: (cartId, quantity) => {
    if (quantity <= 0) {
      set((state) => ({ items: state.items.filter((i) => i.cartId !== cartId) }));
    } else {
      set((state) => ({
        items: state.items.map((i) =>
          i.cartId === cartId ? { ...i, quantity } : i
        ),
      }));
    }
  },

  removeItem: (cartId) =>
    set((state) => ({ items: state.items.filter((i) => i.cartId !== cartId) })),

  clearCart: () => set({ items: [] }),

  totalAmount: () =>
    get().items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    ),

  totalCount: () =>
    get().items.reduce((sum, item) => sum + item.quantity, 0),
}));
