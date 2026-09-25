// Firestore collection names — single source of truth so both apps + functions agree.
export const COL = {
  SETTINGS: 'settings',
  LANGUAGES: 'languages',
  UI_STRINGS: 'uiStrings',
  CURRENCIES: 'currencies',
  COUNTRIES: 'countries',
  GEO_ZONES: 'geoZones',
  TAX_CLASSES: 'taxClasses',
  TAX_RATES: 'taxRates',
  ATTRIBUTE_GROUPS: 'attributeGroups',
  QUANTITY_UNITS: 'quantityUnits',
  SOLD_OUT_STATUSES: 'soldOutStatuses',
  DELIVERY_STATUSES: 'deliveryStatuses',
  MANUFACTURERS: 'manufacturers',
  SUPPLIERS: 'suppliers',
  CATEGORIES: 'categories',
  PRODUCTS: 'products',
  STOCK_MOVEMENTS: 'stockMovements',
  ORDER_STATUSES: 'orderStatuses',
  ORDERS: 'orders',
  CUSTOMERS: 'customers',
  STAFF_USERS: 'staffUsers',
  PAGES: 'pages',
  SLIDES: 'slides',
  PAYMENT_MODULES: 'paymentModules',
  SHIPPING_MODULES: 'shippingModules',
  NEWSLETTER_SUBSCRIBERS: 'newsletterSubscribers',
};

/** Order status stock_action, mirrors LiteCart's order_statuses.stock_action. */
export const STOCK_ACTION = {
  NONE: 'none',
  RESERVE: 'reserve',
  COMMIT: 'commit',
};

export const ORDER_SOURCE = {
  POS: 'pos',
  ECOM: 'ecom',
};

/** Reasons recorded on a stockMovements ledger entry. */
export const STOCK_REASON = {
  POS_SALE: 'pos_sale',
  ORDER_RESERVE: 'order_reserve',
  ORDER_UNRESERVE: 'order_unreserve',
  ORDER_COMMIT: 'order_commit',
  ORDER_RESTOCK: 'order_restock',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
  RECEIVING: 'receiving',
};

/** Default order status codes seeded into orderStatuses; ids are Firestore doc ids matching these codes. */
export const DEFAULT_ORDER_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  DISPATCHED: 'dispatched',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

/** Admin app sections used by the staff permissions map (mirrors LiteCart's apps/docs whitelist). */
export const ADMIN_APPS = [
  'catalog',
  'orders',
  'customers',
  'reports',
  'pages',
  'slides',
  'settings',
  'users',
  'languages',
  'countries',
  'currencies',
  'tax',
  'modules',
];
