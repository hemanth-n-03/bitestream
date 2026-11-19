# BiteStream — Real-Time Food Delivery Management System

> **Status:** Phase 8 (Admin Analytics, Academic Performance Experiments, Dependency/Security Hardening, Code Splitting & 4-Role Browser E2E Verification) Complete — Ready for Academic Demo & Phase 9 Wrap-Up.

## 1. Project Abstract

**BiteStream** is a full-stack, multi-role real-time food delivery management platform engineered with **MongoDB Atlas**, **Node.js**, **Express.js**, **Socket.IO**, **React.js**, and **Leaflet Maps**. Unlike traditional request-response CRUD prototypes, BiteStream demonstrates two production-grade MongoDB distributed capabilities:

1. **Geospatial Indexing (`2dsphere`)** for low-latency nearby restaurant discovery (`$near`, `$geoWithin`, `$maxDistance`) and nearest available delivery partner matching.
2. **MongoDB Change Streams** (`Order.watch()`) decoupled from **Socket.IO** to detect database-level mutations on the `orders` collection and push real-time, role-authorized updates to Customers, Restaurants, Delivery Partners, and Administrators without database polling.

---

## 2. Problem Statement & Objectives

### Problem Statement
Conventional academic food delivery systems rely on periodic HTTP polling for order status updates and naive client-side loops for location filtering. As concurrent users grow, polling saturates database read IOPS, introduces stale UI state, and fails to scale proximity searches.

### Existing System Limitations
- Full collection scans (`COLLSCAN`) for location queries using flat latitude/longitude math.
- High-frequency HTTP polling (`setInterval`) causing redundant read queries and notification latency.
- Tight coupling between REST controllers and UI updates, missing database-level triggers when state mutates externally or transactionally.

### Proposed System & Core Objectives
- **Multi-Role Platform:** Dedicated workflows for Customers, Restaurant Partners, Delivery Partners, and Administrators.
- **2dsphere Geospatial Engine:** GeoJSON `[longitude, latitude]` coordinate storage with MongoDB `2dsphere` indexes and measurable `explain("executionStats")` benchmarks.
- **Change-Stream Event Pipeline:** Replica-set-backed `Order.watch()` listener with resume tokens, deduplication, and room-scoped Socket.IO broadcasting.
- **Strict State Machine & Security:** Validated order lifecycle (`PLACED` → `ACCEPTED` → `PREPARING` → `READY_FOR_PICKUP` → `PICKED_UP` → `OUT_FOR_DELIVERY` → `DELIVERED`, plus `REJECTED`/`CANCELLED`), JWT authentication, RBAC, and ownership checks.
- **Live GPS Tracking:** Throttled Geolocation updates rendered smoothly on interactive Leaflet + OpenStreetMap maps.

---

## 3. System Architecture

```text
+-------------------+     +---------------------+     +----------------------+
| Customer Web App  |     | Restaurant Dashboard|     | Delivery Partner App |
| (React + Leaflet) |     | (React + Socket.IO) |     | (React + Geolocation)|
+---------+---------+     +----------+----------+     +-----------+----------+
          |                          |                            |
          +------------+-------------+----------------------------+
                       | REST (HTTPS/JWT) & WebSockets (Socket.IO)
                       v
        +--------------+----------------------------------+
        |         Node.js + Express API Server            |
        |  - Auth / RBAC / Rate Limiting / Zod Validation |
        |  - Order State Machine & Assignment Service     |
        |  - Socket.IO Gateway (JWT Auth & Scoped Rooms)  |
        +--------------+--------------------+-------------+
                       |                    ^
         CRUD &        |                    | Change Events
         Transactions  |                    | (Insert / Update)
                       v                    |
        +--------------+--------------------+-------------+
        |      MongoDB Atlas (Replica Set Cluster)        |
        |  - 2dsphere Indexes (restaurants, partners)     |
        |  - Change Streams on `orders` collection        |
        +-------------------------------------------------+
```

---

## 4. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), React Router v7, Axios, Socket.IO Client, Leaflet, React-Leaflet v5, Lucide Icons |
| **Backend** | Node.js (v24+), Express.js, Mongoose, Socket.IO, JWT (`jsonwebtoken`), `bcrypt`, `zod`, `helmet`, `cors`, `express-rate-limit`, `morgan` |
| **Database** | MongoDB Atlas (Replica Set required for Change Streams) |
| **Maps** | Leaflet + OpenStreetMap |
| **Testing & Tooling** | VS Code, Git, GitHub, Postman, `mongosh` |
| **Deployment (Planned)** | Vercel (Frontend), Render (Backend), MongoDB Atlas (Database) |

---

## 5. Folder Structure

```text
bitestream/
├── .gitignore
├── README.md
├── PROJECT_PROGRESS.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── src/
│   │   ├── config/          # env.js, db.js
│   │   ├── models/          # 7 Mongoose collections
│   │   ├── controllers/     # REST controllers
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Geospatial, Change Stream, Assignment, State Machine
│   │   ├── middleware/      # Auth, RBAC, Validation, Rate Limit, Error handling
│   │   ├── socket/          # Socket.IO server & room authorization
│   │   ├── validators/      # Zod request schemas
│   │   ├── utils/           # Helpers, AppError, GeoJSON validators
│   │   ├── app.js
│   │   └── server.js
│   └── scripts/
│       ├── seed.js          # Mysuru sample dataset
│       └── experiments/     # Performance benchmark scripts
├── frontend/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── api/
│       ├── components/
│       ├── context/
│       ├── data/
│       ├── hooks/
│       ├── layouts/
│       ├── pages/
│       ├── utils/
│       ├── App.jsx
│       ├── index.css
│       └── main.jsx
└── docs/
    └── api-collection/
```

---

## 6. Database Schema Design (7 Collections)

> All GeoJSON coordinates strictly follow `[longitude, latitude]` order.

1. **`users`**: `name`, `email` (unique), `passwordHash`, `phone`, `role` (`customer | restaurant | delivery | admin`), `address`, `isActive`, timestamps.
2. **`restaurants`**: `ownerId` → `users`, `name`, `description`, `cuisineTypes`, `address`, `location` (GeoJSON `Point`, **`2dsphere` index**), `openingHours`, `rating`, `isActive`, `isOpen`, timestamps.
3. **`food_items`**: `restaurantId` → `restaurants`, `name`, `description`, `price`, `category`, `image`, `isVeg`, `availability`, timestamps.
4. **`orders`**: `orderNumber`, `customerId` → `users`, `restaurantId` → `restaurants`, `deliveryPartnerId` → `delivery_partners` (nullable), `items`, `totalAmount`, `deliveryLocation` (GeoJSON `Point`), `status` (9-state enum), `statusHistory`, `paymentStatus`, timestamps.
5. **`delivery_partners`**: `userId` → `users`, `name`, `phone`, `vehicleType`, `availability` (`OFFLINE | ONLINE | BUSY`), `currentLocation` (GeoJSON `Point`, **`2dsphere` index**), `activeOrderId` → `orders`, `totalDeliveries`, `totalEarnings`, timestamps.
6. **`payments`**: `orderId` → `orders`, `customerId` → `users`, `amount`, `method`, `status`, `transactionRef`, timestamps.
7. **`notifications`**: `recipientUserId` → `users`, `orderId` → `orders`, `type`, `title`, `message`, `isRead`, timestamps.

---

## 7. Planned API Endpoints

- `/api/health` — Service & phase health check (Active in Phase 1)
- `/api/auth` — Register, Login, Current User (`/me`)
- `/api/users` — Profile & saved address management
- `/api/restaurants` — Nearby discovery (`$near`), `$geoWithin` zone queries, details, restaurant profile CRUD
- `/api/food` — Menu browsing, restaurant menu CRUD, availability toggles
- `/api/orders` — Placement (transactional), history, status transitions, cancellation
- `/api/delivery` — Online/offline toggle, GPS location updates, nearby/assigned tasks, earnings
- `/api/admin` — Platform KPIs, user/restaurant/partner governance, order monitoring
- `/api/notifications` — Notification history & read-state toggles

---

## 8. Development Roadmap

- **Phase 1:** Requirements Analysis, System Architecture, Folder Structure & Environment Scaffold *(Completed)*
- **Phase 2:** Frontend UI Foundation & Customer/Dashboard Layouts with Temporary Mysuru Mock Data *(Completed)*
- **Phase 3:** Interactive Leaflet Maps & Mocked Geospatial Discovery UX *(Completed)*
- **Phase 4:** MongoDB Atlas Configuration, 7 Mongoose Schemas, JWT/bcrypt Auth & RBAC APIs *(Completed)*
- **Phase 5:** MongoDB `2dsphere` Geospatial Indexing, Query APIs & Seed Data (Mysuru) *(Completed)*
- **Phase 6:** Core Order Management Workflow, Transactions & Role Dashboards Integration *(Completed)*
- **Phase 7:** MongoDB Change Streams, Socket.IO Engine, Auto-Assignment & Live GPS Tracking *(Completed)*
- **Phase 8:** Admin Analytics, Security Hardening, Code Splitting, 4-Role Browser E2E & Performance Experiments (Exp 1 & Exp 2) *(Completed)*
- **Phase 9:** Final Academic Presentation, Viva Report & Postman Collection Finalization *(Next)*

---

## 9. Local Setup & Live Academic Demonstration (Phase 8)

```powershell
# One-click PowerShell launcher from project root (opens Backend & Frontend windows):
.\start-local.ps1 -SeedDemo

# OR manually in two terminals (ensure backend/.env is configured from backend/.env.example):
# Terminal 1 — Backend + Socket.IO + MongoDB Change Streams
cd backend
npm install
npm run seed:demo   # Seeds 8 kitchens, 23 dishes, 4 partners + 10 demo orders
npm run dev

# Terminal 2 — Frontend (React + Vite + Tailwind v4 + Leaflet)
cd frontend
npm install
npm run dev
```

### Reproducible Academic Experiments (`docs/experiments/`)
```bash
# Experiment 1: MongoDB 2dsphere Index vs COLLSCAN (500 / 1,500 / 5,000 docs)
cd backend
npm run exp:geo        # Outputs docs/experiments/exp1_geospatial_results.json + .svg

# Experiment 2: MongoDB Change Streams (Push) vs HTTP Polling (1s & 2s, 15 clients)
npm run exp:realtime   # Outputs docs/experiments/exp2_changestreams_results.json + .svg
```

### Seeded Local Demo Logins (`Password: SeedPass@2026`)
- **Customer:** `ananya@bitestream.dev` | `rohan@bitestream.dev`
- **Restaurant Owner:** `owner.mylari@bitestream.dev` (`owner.kalidasa@bitestream.dev`, etc.)
- **Delivery Partner:** `rider.karthik@bitestream.dev` | `rider.mahesh@bitestream.dev` | `rider.prashanth@bitestream.dev`
- **Admin:** `admin@bitestream.dev`

### Implemented Backend API & Security Modules (Phases 4–8)
- `GET /api/health` — Service health + live MongoDB Atlas connection, replica-set, Socket.IO & 4-collection Change Stream status (`phase: 8`)
- `POST /api/auth/register` & `POST /api/auth/login` — JWT + `bcrypt` authentication behind Helmet, `sanitizeNoSqlInputs` NoSQL operator stripping, `rateLimit`, and Zod v4 validation (`0` audit vulnerabilities)
- `GET /api/users/profile` & `PATCH /api/users/profile` — Protected profile management
- `GET /api/restaurants/nearby`, `GET /api/restaurants/nearby/:id`, `GET /api/restaurants/:id/menu`, `GET /api/restaurants/search`, `GET /api/restaurants/categories` — MongoDB `2dsphere` geospatial discovery (`$geoNear`, `$near`, `$geoWithin`), live menu & category counts
- `GET /api/restaurants/:id/location`, `PATCH /api/restaurants/:id/location`, `PATCH /api/restaurants/:id/status`, & `GET /api/restaurants/owner/dashboard` — Owner/Admin kitchen discovery, GeoJSON location & open/closed status controls
- `GET /api/food`, `GET /api/food/my-menu`, `POST /api/food`, `PATCH /api/food/:id`, `PATCH /api/food/:id/availability`, `DELETE /api/food/:id` — Public menu queries + owner/admin menu CRUD
- `POST /api/orders`, `GET /api/orders/my`, `GET /api/orders/restaurant`, `GET /api/orders/:id`, `PATCH /api/orders/:id/status`, `POST /api/orders/:id/cancel`, `POST /api/orders/:id/reassign` — Transactional COD order creation, 9-state lifecycle, payment sync, auto-dispatch on `READY_FOR_PICKUP`, and controlled reassignment
- `GET /api/delivery/partner/me`, `PATCH /api/delivery/partner/availability`, `PATCH /api/delivery/partner/location`, `GET /api/delivery/tasks/available`, `POST /api/delivery/tasks/:orderId/accept`, `POST /api/delivery/tasks/:orderId/confirm`, `POST /api/delivery/tasks/:orderId/reject`, `GET /api/delivery/orders/history` — Rider profile, GPS/availability updates, atomic task claim/confirm/decline, and delivery history
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all` — Persistent user notifications & read state management with partial-unique `dedupeKey` protection
- `GET /api/admin/overview` — Real MongoDB aggregation analytics (`restaurantPerformance`, `topDishes`, `dailyTrend`, `paymentBreakdown`, `partnerLeaderboard`, `avgOrderValue`, `completionRatePct`), plus filtered orders and moderation endpoints under `/api/admin`
- **Real-Time Socket.IO & Change Streams (`backend/src/realtime/`):** `.watch()` streams on `orders`, `restaurants`, `delivery_partners`, and `notifications` with resume-token recovery, oplog deduplication, JWT socket auth, role/ownership-verified rooms, and throttled rider GPS broadcasts restricted to active order participants

### Implemented Frontend Routes & Real-Time UI (Phases 2–8)
- Code-split lazy routes (`React.lazy` + `Suspense`) and Vite `manualChunks` (`react-vendor`, `leaflet-vendor`, `realtime-vendor`, `icons-vendor`) with memoized `ToastContext` and `0` unused legacy mock files
- `/` & `/restaurant/:id` — Live MongoDB `2dsphere` discovery, live `RESTAURANT_STATUS_UPDATED` kitchen availability sync, interactive Leaflet maps, menu filtering, and sliding COD Cart Checkout (`CartDrawer.jsx`)
- `/login` & `/register` — Real MongoDB JWT auth with seeded role quick-fill
- `/orders` & `/profile` — Live Change-Stream customer order tracking, non-remounting Leaflet rider GPS tracking (`LiveTrackingMap.jsx`), bell notifications (`NotificationBell.jsx`), eligible cancel, and disconnected fallback polling
- `/restaurant/dashboard`, `/delivery/dashboard`, `/admin/dashboard` — Live MongoDB portals with Change Streams push, kitchen chimes + mute control, progressive `$near` rider auto-assignment, throttled 5s GPS stream, and real aggregation charts & screenshots verified in `docs/screenshots/`
