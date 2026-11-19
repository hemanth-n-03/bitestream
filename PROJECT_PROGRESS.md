# BiteStream — Project Progress Log

## Current Phase: Phase 7 (MongoDB Change Streams, Socket.IO & Real-Time Delivery Assignment)

### Completed Phases
- **Phase 1: Architecture & Initial Scaffold** *(Completed & Verified)*
  - Analyzed full system requirements across 4 roles and 5 functional/technical modules.
  - Designed decoupled REST + Socket.IO + MongoDB Change Streams + `2dsphere` architecture.
  - Designed 7-collection normalized MongoDB schema with strict `[longitude, latitude]` GeoJSON conventions.
  - Audited local Windows (`win32-arm64`) development environment.
  - Created project structure, `.gitignore`, `.env.example` templates, living `README.md`, and runnable Phase 1 backend & frontend skeletons.
  - Installed all backend and frontend npm dependencies, resolved `win32-arm64` `bcrypt` compatibility (`^5.1.1` → `^6.0.0`), generated `package-lock.json` for both projects, and passed runtime smoke tests.
- **Phase 2: Frontend UI Foundation & Multi-Role Interface** *(Completed & Verified)*
  - Created cohesive **BiteStream** design system (Tailwind CSS v4, `Plus Jakarta Sans` + `Inter`, responsive layouts, status/veg/role badges, modals, and toast notifications).
  - Built temporary Mysuru mock dataset (`6` Mysuru kitchens, `16` dishes, `6` Mysuru zones with GeoJSON `[lng, lat]`, sample orders, delivery partners, and users) + reactive cross-portal state (`AppDataContext`, `CartContext`, `LocationContext`, `AuthContext`, `ToastContext`).
  - Implemented all Customer pages (Home discovery with distance sorting, search, category/veg filters, Restaurant details, sliding Basket drawer with single-restaurant guard & checkout, Order history + timeline, Profile & saved Mysuru addresses, Login & Register UI).
  - Implemented Restaurant, Delivery Partner, and Admin dashboards with interactive state transitions, Menu CRUD, availability toggles, and platform monitoring.
- **Phase 3: Interactive Leaflet Maps & Mocked Geospatial UX** *(Completed & Verified)*
  - Built reusable Leaflet + OpenStreetMap map primitives (`MapPrimitives.jsx` with `ResizeObserver` `invalidateSize` lifecycle controller & custom `L.divIcon` pins) and `useGeolocation.js` hook with permission/timeout error handling.
  - Built `LocationPickerMap.jsx` (click-to-pin, draggable marker, Browser GPS lock, Mysuru presets, `[lng, lat]` GeoJSON display), `NearbyRestaurantsMap.jsx` (radius circle, interactive kitchen markers + popups), and `LiveTrackingMap.jsx` (3-pin Kitchen/Rider/Customer route polyline & live distance metrics).
  - Integrated maps across Customer Discovery (`HomePage.jsx` Map+List/Full Map/Grid + `2/5/10 km` radius filters), global Navbar Pin Modal (`CustomerLayout.jsx`), `ProfilePage.jsx`, `OrdersPage.jsx`, `RestaurantDashboardPage.jsx`, and `DeliveryDashboardPage.jsx`.
- **Phase 4: MongoDB Atlas Connection, Schemas, Auth & RBAC** *(Completed & Verified)*
  - Configured `backend/.env` locally (ignored by `.gitignore`, placeholders preserved in `backend/.env.example`) and connected to MongoDB Atlas (`bitestream` database on replica set `atlas-hn7my4-shard-0`).
  - Implemented all 7 normalized Mongoose schemas (`User`, `Restaurant`, `FoodItem`, `Order`, `DeliveryPartner`, `Payment`, `Notification`) plus shared `geoPointSchema.js` with `2dsphere` indexes on `restaurants.location`, `delivery_partners.currentLocation`, and `orders.deliveryLocation`.
  - Implemented `bcrypt` (`12` rounds) + `jsonwebtoken` authentication, transactional delivery partner profile provisioning, Zod validation middleware, `express-rate-limit` limiters, centralized Mongoose/JWT error handling, and 4-role RBAC middleware (`protect`, `authorize`).
- **Phase 5: MongoDB `2dsphere` Geospatial Indexing, Mysuru Seed & Live Discovery** *(Completed & Verified)*
  - Implemented idempotent seeding in `backend/src/seed/seedDatabase.js` (`8` Mysuru restaurants, `23` food items, `4` delivery partners, `2` sample customers, `8` owners, `1` admin) with explicit `--reset --confirm-reset` safeguard.
  - Implemented real MongoDB `2dsphere` geospatial queries (`$geoNear`, `$near`, `$geoWithin` with `$centerSphere`, `$maxDistance` in meters, `distanceKm` projection) and `6` validated discovery/location endpoints under `/api/restaurants` plus owner-verified `PATCH /api/restaurants/:id/location`.
  - Connected `HomePage.jsx`, `NearbyRestaurantsMap.jsx`, `CategoryBar.jsx`, and `RestaurantDetailsPage.jsx` to live MongoDB APIs (`src/api/restaurantApi.js`) and removed mock data imports from customer discovery flows.
  - Executed `explain("executionStats")` benchmark (`backend/scripts/experiments/benchmarkGeo.js`) proving `location_2dsphere` index usage vs `COLLSCAN`.
- **Phase 6: Transactional Order Lifecycle, Menu CRUD & Multi-Role Dashboard Integration** *(Completed & Verified)*
  - Implemented MongoDB multi-document transaction (`mongoose.startSession()` + `session.withTransaction()`) for COD order creation (`Order` + `Payment`), server-side price/tax/fee recomputation (`itemsTotal >= 399 ? 0 : 25` delivery, `5%` tax), and per-customer `idempotencyKey` replay protection.
  - Implemented the 9-state order lifecycle (`PLACED`, `ACCEPTED`, `PREPARING`, `READY_FOR_PICKUP`, `PICKED_UP`, `OUT_FOR_DELIVERY`, `DELIVERED`, `REJECTED`, `CANCELLED`) with `statusHistory` audit trail, role + ownership checks, COD `Payment` completion (`SUCCESS`), and rider release (`+1` delivery, `+55` INR) on `DELIVERED`.
  - Built `/api/food` Menu CRUD APIs with restaurant ownership validation, `/api/delivery` rider availability/GPS/`READY_FOR_PICKUP` atomic task claim (`$set: { deliveryPartnerId }` + `BUSY`), `/api/restaurants/:id/status` open toggle, and `/api/admin` platform overview, filtered orders, and moderation endpoints; removed superseded `roleCheckRoutes.js`.
  - Connected `CartDrawer.jsx`, `OrdersPage.jsx`, `ProfilePage.jsx`, `LoginPage.jsx`, `RegisterPage.jsx`, `RestaurantDashboardPage.jsx`, `DeliveryDashboardPage.jsx`, and `AdminDashboardPage.jsx` to live MongoDB REST APIs behind `AuthContext.jsx` JWT persistence and `RoleAccessGate.jsx`, detaching `AppDataContext.jsx` / `mysuruMockData.js` from all active flows.
- **Phase 7: MongoDB Change Streams, Socket.IO Engine & Nearest-Rider Auto-Assignment** *(Completed & Verified)*
  - Implemented real MongoDB Change Streams (`Model.watch()` on `orders`, `restaurants`, `delivery_partners`, `notifications` with `fullDocument: 'updateLookup'`), resume tokens (`resumeAfter`), exponential-backoff stream recovery, oplog event deduplication, and clean graceful shutdown in `server.js`.
  - Implemented JWT-authenticated Socket.IO server (`socketServer.js`) with verified room isolation (`customer:<userId>`, `restaurant:<restaurantId>`, `delivery:<partnerId>`, `delivery:pool`, `user:<userId>`, `admin`, `restaurants:catalog`), MongoDB ownership verification on `join_room`, and server-throttled (`GPS_DB_WRITE_INTERVAL_MS`) `delivery:location_update` ingestion.
  - Implemented configurable progressive `$near` geospatial nearest-rider auto-assignment (`deliveryAssignmentService.js`), atomic `Order` + `DeliveryPartner` claim transactions, partner confirm/reject flows, timeout release + next-nearest reassignment, non-silent `NO_PARTNER_AVAILABLE` outcomes, and `POST /api/orders/:id/reassign`.
  - Built idempotent Notification persistence (`Notification.dedupeKey` partial unique index + `/api/notifications`), Web Audio kitchen alert chimes with mute control, non-remounting live Leaflet rider GPS tracking (`fitKey`), and real-time updates + disconnected fallback refresh across all 4 portals.

- **Phase 8: Admin Analytics, Security Hardening, Code Splitting & Performance Experiments** *(Completed & Verified — Academic Demo Scope)*
  - Removed all production hosting/deployment tasks per scope correction and prioritized local academic execution & live demonstration readiness.
  - Enriched `GET /api/admin/overview` (`adminService.js`) with genuine MongoDB aggregation pipelines (`dailyTrend`, `restaurantPerformance`, `topDishes`, `paymentBreakdown`, `partnerLeaderboard`, `avgOrderValue`, `completionRatePct`) and visualized them inside `AdminDashboardPage.jsx`.
  - Added `--with-orders` (`npm run seed:demo`) idempotent demo order seeding (`BS-DEMO-1001`..`BS-DEMO-1010`), `start-local.ps1` local Windows demo launcher, `sanitizeNoSqlInputs` middleware (`app.js`), upgraded `zod@^4` (`npm audit`: `0` vulnerabilities across both `backend` and `frontend`), removed legacy unused `AppDataContext.jsx` & `mysuruMockData.js`, and added `React.lazy` + Vite `manualChunks` code splitting.
  - Completed both academic benchmarks against live MongoDB Atlas (`benchmarkGeo.js` & `benchmarkChangeStreams.js`) saving verified JSON + SVG graphs under `docs/experiments/`, and completed live 4-role headless Chromium E2E testing with `0` runtime errors and visual screenshots under `docs/screenshots/`.

### Pending Phases
- **Phase 9:** Project Transfer / Final Documentation / Academic Presentation & Viva Readiness *(Next)*

---

### Local Environment Audit (Phase 1)
- **OS & Architecture:** Windows (`win32`, `arm64`)
- **Node.js:** `v24.21.0` (ABI `137`)
- **npm:** `11.19.0`
- **Git:** `2.53.0.windows.1` (Note: global `user.email` is currently `example@.com`; update before pushing to GitHub)
- **VS Code CLI:** Installed (`code.cmd`)
- **MongoDB Shell (`mongosh`):** `2.13.0` installed
- **Python:** `C:\Python314\python.exe`

---

### Files Created in Phase 1
- `.gitignore`
- `README.md`
- `PROJECT_PROGRESS.md`
- `backend/.env.example`
- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/config/env.js`
- `backend/src/app.js`
- `backend/src/server.js`
- `frontend/.env.example`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/vite.config.js`
- `frontend/index.html`
- `frontend/src/index.css`
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`

---

### Files Created / Updated in Phase 2
- `frontend/src/index.css` & `frontend/src/App.jsx`
- `frontend/src/utils/formatters.js` & `frontend/src/utils/geo.js`
- `frontend/src/data/mysuruMockData.js`
- `frontend/src/context/ToastContext.jsx`, `LocationContext.jsx`, `AuthContext.jsx`, `CartContext.jsx`, `AppDataContext.jsx`
- `frontend/src/components/common/Badge.jsx`, `EmptyState.jsx`, `StatCard.jsx`, `Modal.jsx`, `ToastContainer.jsx`, `Navbar.jsx`, `Footer.jsx`
- `frontend/src/components/customer/CategoryBar.jsx`, `RestaurantCard.jsx`, `FoodItemCard.jsx`, `CartDrawer.jsx`, `OrderTimeline.jsx`
- `frontend/src/layouts/CustomerLayout.jsx`, `DashboardLayout.jsx`
- `frontend/src/pages/public/HomePage.jsx`, `RestaurantDetailsPage.jsx`, `LoginPage.jsx`, `RegisterPage.jsx`
- `frontend/src/pages/customer/OrdersPage.jsx`, `ProfilePage.jsx`
- `frontend/src/pages/restaurant/RestaurantDashboardPage.jsx`
- `frontend/src/pages/delivery/DeliveryDashboardPage.jsx`
- `frontend/src/pages/admin/AdminDashboardPage.jsx`

---

### Files Created / Updated in Phase 3
- `frontend/src/main.jsx` & `frontend/src/index.css` (imported `leaflet/dist/leaflet.css`, rider pulse keyframe, Leaflet stacking rules)
- `frontend/src/utils/geo.js` (`toLatLng`, `toGeoJsonPoint`, `isValidGeoCoords`, `interpolateCoords`, `calculateRouteMetrics`)
- `frontend/src/hooks/useGeolocation.js`
- `frontend/src/context/LocationContext.jsx` & `frontend/src/context/AppDataContext.jsx`
- `frontend/src/components/maps/MapPrimitives.jsx`, `LocationPickerMap.jsx`, `NearbyRestaurantsMap.jsx`, `LiveTrackingMap.jsx`
- `frontend/src/components/common/Navbar.jsx` & `frontend/src/layouts/CustomerLayout.jsx`
- `frontend/src/pages/public/HomePage.jsx`, `frontend/src/pages/customer/ProfilePage.jsx`, `frontend/src/pages/customer/OrdersPage.jsx`
- `frontend/src/pages/restaurant/RestaurantDashboardPage.jsx`, `frontend/src/pages/delivery/DeliveryDashboardPage.jsx`

---

### Files Created / Updated in Phase 4
- `backend/.env` (local-only credentials; excluded by `.gitignore`)
- `backend/src/config/env.js` & `backend/src/config/db.js`
- `backend/src/utils/AppError.js` & `backend/src/utils/asyncHandler.js`
- `backend/src/models/geoPointSchema.js`, `User.js`, `Restaurant.js`, `FoodItem.js`, `Order.js`, `DeliveryPartner.js`, `Payment.js`, `Notification.js`, `index.js`
- `backend/src/middleware/authMiddleware.js`, `validateMiddleware.js`, `rateLimitMiddleware.js`, `errorMiddleware.js`
- `backend/src/validators/authValidator.js`
- `backend/src/services/authService.js`
- `backend/src/controllers/authController.js`
- `backend/src/routes/authRoutes.js`, `userRoutes.js`, `roleCheckRoutes.js`
- `backend/src/app.js` & `backend/src/server.js`

---

### Files Created / Updated in Phase 5
- `backend/package.json`, `backend/src/app.js`, `backend/src/models/Restaurant.js`, `backend/src/routes/roleCheckRoutes.js`
- `backend/src/seed/seedDatabase.js`
- `backend/src/utils/geoHelpers.js`
- `backend/src/validators/restaurantValidator.js`
- `backend/src/services/restaurantGeoService.js`
- `backend/src/controllers/restaurantController.js`
- `backend/src/routes/restaurantRoutes.js`
- `backend/scripts/experiments/benchmarkGeo.js`
- `frontend/src/api/client.js` & `frontend/src/api/restaurantApi.js`
- `frontend/src/components/customer/CategoryBar.jsx` & `frontend/src/components/maps/NearbyRestaurantsMap.jsx`
- `frontend/src/pages/public/HomePage.jsx` & `frontend/src/pages/public/RestaurantDetailsPage.jsx`

---

### Files Created / Updated in Phase 6
- **Backend Created:**
  - `backend/src/validators/orderValidator.js`, `foodValidator.js`, `deliveryValidator.js`
  - `backend/src/services/orderStateService.js`, `orderService.js`, `foodService.js`, `deliveryService.js`, `adminService.js`
  - `backend/src/controllers/orderController.js`, `foodController.js`, `deliveryController.js`, `adminController.js`
  - `backend/src/routes/orderRoutes.js`, `foodRoutes.js`, `deliveryRoutes.js`, `adminRoutes.js`
- **Backend Modified & Cleaned Up:**
  - `backend/src/models/Order.js` (`idempotencyKey` + partial unique `{ customerId: 1, idempotencyKey: 1 }` index)
  - `backend/src/services/restaurantGeoService.js`, `backend/src/controllers/restaurantController.js`, `backend/src/routes/restaurantRoutes.js` (`PATCH /api/restaurants/:id/status`)
  - `backend/src/app.js` (mounted `/api/food`, `/api/orders`, `/api/delivery`, `/api/admin`; `phase: 6` health)
  - Removed superseded `backend/src/routes/roleCheckRoutes.js`
- **Frontend Created:**
  - `frontend/src/api/authApi.js`, `orderApi.js`, `foodApi.js`, `deliveryApi.js`, `adminApi.js`
  - `frontend/src/components/common/RoleAccessGate.jsx`
- **Frontend Modified:**
  - `frontend/src/api/restaurantApi.js`, `frontend/src/context/AuthContext.jsx`, `frontend/src/App.jsx`
  - `frontend/src/components/common/Navbar.jsx`, `frontend/src/layouts/DashboardLayout.jsx`
  - `frontend/src/components/customer/CartDrawer.jsx`, `frontend/src/pages/public/LoginPage.jsx`, `frontend/src/pages/public/RegisterPage.jsx`
  - `frontend/src/pages/customer/OrdersPage.jsx`, `frontend/src/pages/customer/ProfilePage.jsx`
  - `frontend/src/pages/restaurant/RestaurantDashboardPage.jsx`, `frontend/src/pages/delivery/DeliveryDashboardPage.jsx`, `frontend/src/pages/admin/AdminDashboardPage.jsx`

---

### Files Created / Updated in Phase 7
- **Backend Created:**
  - `backend/src/realtime/socketServer.js`, `backend/src/realtime/changeStreamManager.js`
  - `backend/src/services/notificationService.js`, `backend/src/services/deliveryAssignmentService.js`
  - `backend/src/validators/notificationValidator.js`
  - `backend/src/controllers/notificationController.js`
  - `backend/src/routes/notificationRoutes.js`
- **Backend Modified:**
  - `backend/src/config/env.js`, `backend/.env.example` (`DELIVERY_RADIUS_STEPS_METERS`, `ASSIGNMENT_OFFER_TIMEOUT_MS`)
  - `backend/src/models/Order.js` (`assignmentStatus`, `assignedAt`, `assignmentExpiresAt`, `assignmentAttempts`, `excludedPartnerIds`)
  - `backend/src/models/Notification.js` (`dedupeKey` + partial unique `{ recipientUserId: 1, dedupeKey: 1 }` index)
  - `backend/src/validators/orderValidator.js`, `backend/src/validators/deliveryValidator.js`
  - `backend/src/services/orderService.js`, `backend/src/services/deliveryService.js`
  - `backend/src/controllers/orderController.js`, `backend/src/controllers/deliveryController.js`
  - `backend/src/routes/orderRoutes.js`, `backend/src/routes/deliveryRoutes.js`
  - `backend/src/app.js`, `backend/src/server.js`
- **Frontend Created:**
  - `frontend/src/api/notificationApi.js`
  - `frontend/src/context/SocketContext.jsx`
  - `frontend/src/components/common/NotificationBell.jsx`
  - `frontend/src/utils/sound.js`
- **Frontend Modified:**
  - `frontend/src/api/orderApi.js`, `frontend/src/api/deliveryApi.js`, `frontend/src/App.jsx`
  - `frontend/src/components/common/Navbar.jsx`, `frontend/src/layouts/DashboardLayout.jsx`
  - `frontend/src/components/maps/MapPrimitives.jsx`, `frontend/src/components/maps/LiveTrackingMap.jsx`
  - `frontend/src/pages/public/HomePage.jsx`, `frontend/src/pages/public/RestaurantDetailsPage.jsx`
  - `frontend/src/pages/customer/OrdersPage.jsx`, `frontend/src/pages/restaurant/RestaurantDashboardPage.jsx`, `frontend/src/pages/delivery/DeliveryDashboardPage.jsx`, `frontend/src/pages/admin/AdminDashboardPage.jsx`

---

### Files Created / Updated in Phase 8
- **Backend Created:**
  - `backend/src/middleware/sanitizeMiddleware.js`
  - `backend/scripts/experiments/benchmarkChangeStreams.js`
  - `start-local.ps1` (root local demo launcher)
- **Backend Modified:**
  - `backend/package.json` (`zod@^4`, `seed:demo`, `exp:geo`, `exp:realtime`), `backend/package-lock.json`
  - `backend/src/app.js` (`sanitizeNoSqlInputs`, `x-powered-by` disabled, `/api/health` `phase: 8`)
  - `backend/src/services/adminService.js` (`analytics` MongoDB aggregation pipelines)
  - `backend/src/seed/seedDatabase.js` (`--with-orders` demo seeding + cleanup)
  - `backend/scripts/experiments/benchmarkGeo.js` (multi-scale `500/1500/5000` JSON + SVG output)
- **Frontend Modified & Cleaned Up:**
  - `frontend/vite.config.js` (`manualChunks` vendor splitting)
  - `frontend/src/App.jsx` (`React.lazy` + `Suspense` route splitting)
  - `frontend/src/context/ToastContext.jsx` & `frontend/src/context/SocketContext.jsx` (memoized `toast` ref eliminating cascading socket/API re-renders)
  - `frontend/src/pages/customer/OrdersPage.jsx` (`expandedMapId` dependency fix)
  - `frontend/src/pages/admin/AdminDashboardPage.jsx` (real MongoDB Analytics charts & tables)
  - `frontend/src/pages/public/HomePage.jsx`, `frontend/src/components/common/Navbar.jsx`, `frontend/src/utils/geo.js` (consistent UI labels)
  - Removed unused `frontend/src/context/AppDataContext.jsx` and `frontend/src/data/mysuruMockData.js`
- **Experiments & Screenshots:**
  - `docs/experiments/exp1_geospatial_results.json`, `exp1_geospatial_benchmark.svg`
  - `docs/experiments/exp2_changestreams_results.json`, `exp2_changestreams_vs_polling.svg`
  - `docs/screenshots/01_customer_discovery_map.png` .. `05_admin_analytics_dashboard.png`

---

### Important Implementation Decisions
1. **ESM Across Full Stack:** Configured `"type": "module"` in both `backend/package.json` and `frontend/package.json` for unified modern ES module syntax on Node.js v24.
2. **Tailwind CSS v4 + React 19 + React-Leaflet v5:** Paired `react@^19.0.0` with `react-leaflet@^5.0.0` (which explicitly requires React 19) and `@tailwindcss/vite` to prevent peer dependency conflicts.
3. **`bcrypt` Upgraded to `^6.0.0` for `win32-arm64`:** `bcrypt@5.1.1` lacked `win32-arm64` prebuilds (`404 Not Found`) and failed MSBuild `v145` fallback compilation. Updating to `bcrypt@^6.0.0` resolved this cleanly with bundled `prebuilds/win32-arm64`.
4. **Full Mock Removal:** Removed legacy `AppDataContext.jsx` and `mysuruMockData.js` completely after migrating 100% of APIs to live MongoDB collections.
5. **GeoJSON `[lng, lat]` vs Leaflet `[lat, lng]` Boundary & `ResizeObserver` Fix:** Enforced strict GeoJSON `[longitude, latitude]` storage across all MongoDB docs & state, converting at the Leaflet boundary via `toLatLng()`.
6. **Standard Replica-Set Atlas URI for Hotspot/DNS Reliability:** Standard 3-shard `mongodb://` replica-set URI connects directly to `atlas-hn7my4-shard-0` reliably across tethered/ISP DNS setups.
7. **Admin Privilege Escalation Prevention & Ownership Checks:** `POST /api/auth/register` blocks `'admin'` self-registration; `PATCH /api/restaurants/:id/location` verifies `restaurant.ownerId === req.user._id` (or `admin`).
8. **Three MongoDB Geospatial Query Modes:** Supported `$geoNear` (default with spherical `distanceKm` projection), `$near`, and `$geoWithin` (`$centerSphere`) on `/api/restaurants/nearby` for full academic & live demonstration.

---

### Known Bugs / Watchpoints
- **Security Concern (Unrotated DB Password):** The MongoDB Atlas `bitestream_admin` password exposed during Phase 4 setup remains unrotated in `backend/.env` per prior user instruction and **should be rotated** before sharing outside local demo.
- **Payment Scope (COD Only):** Orders settle via Cash on Delivery (`COD`) via `Payment` (`PENDING` -> `SUCCESS` / `FAILED`); simulated UPI/Card payment gateways are not wired.
- Remember to update global Git `user.email` (`example@.com`) before pushing to GitHub.

---

### Testing & Benchmark Results (Phases 1–8)
- **Dependency Security Audit (`npm audit`):** `0` vulnerabilities across both `backend` (135 packages after upgrading `zod` to `^4`) and `frontend`.
- **Experiment 1 (`npm run exp:geo`, live MongoDB Atlas `explain('executionStats')` at 2 km):**
  - `500` docs: Unindexed `COLLSCAN` (`500` docs examined, `1 ms`) vs Indexed `2dsphere` `$geoWithin` (`19` docs examined, **`96.2%` fewer**, `1 ms`) & `$near` (`33` docs examined, `0 ms`).
  - `1,500` docs: Unindexed `COLLSCAN` (`1,500` docs, `3 ms`) vs Indexed `$geoWithin` (`53` docs, **`96.5%` fewer**, `1 ms`) & `$near` (`94` docs, `1 ms`).
  - `5,000` docs: Unindexed `COLLSCAN` (`5,000` docs, `9 ms`) vs Indexed `$geoWithin` (`170` docs, **`96.6%` fewer**, `2 ms`) & `$near` (`305` docs, `1 ms` — 9x faster).
- **Experiment 2 (`npm run exp:realtime`, live MongoDB Atlas + Socket.IO WebSocket):**
  - Change Streams (`12` DB mutations): `min: 176.1 ms`, `avg: 211.4 ms`, `p95: 520 ms`, `0` polling DB read queries.
  - `1s` HTTP Polling (`15` concurrent clients, `4s` window): `60` DB queries issued (`57` redundant = **`95%` wasted reads**), avg RTT `543.9 ms`, est. detection lag `1043.9 ms`.
  - `2s` HTTP Polling (`15` concurrent clients, `4s` window): `30` DB queries (`93.3%` redundant), est. detection lag `1321.3 ms`.
  - Change Streams cut detection delay by **`79.7%` (`4.94x` speedup)** vs `1s` polling with `0` polling DB reads.
- **4-Role Headless Chromium E2E (`verify_phase8_browser.mjs`, exit code `0`, `0` console/runtime errors):**
  - Customer signed in -> discovered live kitchens on `NearbyRestaurantsMap` -> opened Mylari menu -> placed real COD order (`BS-64754092`) -> redirected to `/orders` with `Live Change Streams` & `LiveTrackingMap`.
  - Restaurant accepted, prepared, marked `READY_FOR_PICKUP` -> UI displayed `Rider: Karthik Gowda (KA-09-EV-4821)` while Customer tab updated in real time via Change Streams without page reload.
  - Delivery rider verified active route map and transitioned `PICKED_UP` -> `OUT_FOR_DELIVERY` -> `DELIVERED`, automatically updating Customer tab to `Payment: PAID (COD)`.
  - Admin verified live MongoDB analytics charts & Orders Monitor; `5` PNG screenshots saved to `docs/screenshots/`.
- **Phase 7 & 8 Atlas Regression (`verify_phase7.mjs`, exit code `0`):** Verified Socket.IO auth/room isolation, Change Streams recovery, nearest-rider assignment & concurrent claims, NoSQL `$ne/$gt` payload rejection (`400 VALIDATION_ERROR`), Admin analytics schema, and clean Atlas teardown.
- **Frontend Production Build (`npm run build`):** `vite v6.4.6` transformed `1790` modules in `2.92s` with `0` chunk warnings (largest JS chunk `258.71 kB` / `79.74 kB` gzip; `dist/assets/index-B0Oeqn5d.css` `72.40 kB`).

---

### Next Development Steps
1. Await user approval of **Phase 8** before copying the project to `C:\Users\ASUS\Documents\BiteStream` and proceeding to **Phase 9**.
