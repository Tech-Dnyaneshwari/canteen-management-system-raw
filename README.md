# Smart Canteen Management System
> **College CEP Project** | Fast, Demonstrable & Production-Ready Pre-Ordering System

---

## 🏛️ Project Architecture (Based on Slide 10)

```
                       ┌──────────────┐
                       │   STUDENT    │
                       └──────┬───────┘
                              │
                       ┌──────▼───────┐
                       │  MOBILE APP  │
                       └──────┬───────┘
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
┌──────▼───────┐       ┌──────▼───────┐       ┌──────▼───────┐
│ MENU & PRICE │       │  PRE-ORDER   │       │   FEEDBACK   │
│     (₹)      │       │(Cart & Slot) │       │   & RATING   │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │
       └──────────────────────┼──────────────────────┘
                              │
                     ┌────────▼────────┐
                     │ORDER MANAGEMENT │
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │    DATABASE     │
                     │ (canteen_db)    │
                     └────────┬────────┘
             ┌────────────────┴────────────────┐
             │                                 │
    ┌────────▼─────────┐              ┌────────▼────────┐
    │  CANTEEN STAFF   │              │ ADMIN DASHBOARD │
    │    DASHBOARD     │              └────────┬────────┘
    └────────┬─────────┘                       │
             │                        ┌────────▼────────┐
    ┌────────▼─────────┐              │    REPORTS /    │
    │  PREPARE ORDER   │              │    ANALYTICS    │
    └────────┬─────────┘              └─────────────────┘
             │
    ┌────────▼─────────┐
    │   ORDER STATUS   │ ───────────────┐
    └──────────────────┘                │ (Live Sync)
                                        │
                               ┌────────▼────────┐
                               │   STUDENT APP   │
                               │  (Live Tracker) │
                               └─────────────────┘
```

---

## 🚀 Key Features

### 1. 📱 Student Mobile / Web App
- **Menu & Price (₹)**: Categorized menu (Breakfast, Snacks, Meals & Thali, Beverages, Desserts) with item descriptions, preparation times, real-time stock levels, and instant search.
- **Pre-Order (Cart & Slot Selection)**: Interactive slide-out cart drawer with item quantity adjustments and auto-computed totals.
- **Slot Selection & Cash at Pickup**: Choose custom pickup slots (e.g., *12:30 PM*, *12:45 PM*, *Immediate*) with zero-hassle Cash-at-Pickup counter payment.
- **Order Token Generation**: Unique token `#SC-XXXX` generated instantly upon checkout.
- **Live Order Tracker**: Visual 5-stage stepper displaying progress in real time:
  1. `Placed` ➔ 2. `Accepted` ➔ 3. `Preparing` ➔ 4. `Ready for Pickup` ➔ 5. `Collected`.
- **Feedback & Rating**: Rate completed meals (1–5 stars) with comments and suggestions.

### 2. 👨‍🍳 Canteen Kitchen Staff Dashboard
- **Live Kitchen Queue**: Real-time incoming order feed with auto-polling (every 4 seconds).
- **Prepare Order Controls**: One-click actions to advance orders through kitchen stages (`Accept Order`, `Start Preparing`, `Mark Ready for Pickup`, `Hand Over & Collected`).
- **Live Status Sync**: Kitchen updates instantly update the student's live tracking view.

### 3. 📊 Admin Dashboard & Reports / Analytics
- **Executive KPIs**: Real-time cards for Today's Revenue, Total Orders Placed, Active Cooking Queue, and Average Student Rating.
- **Reports & Analytics**: Visual charts for *Most Popular Canteen Items* and real-time *Order Status Distribution*.
- **Menu & Inventory Management**: Add new dishes, edit prices, update stock levels, toggle availability switches, or delete items.
- **Customer Reviews Feed**: Browse student ratings and feedback remarks.

---

## 🛠️ Technology Stack

- **Backend**: Node.js & Express REST API (`server.js`)
- **Database**: Atomic JSON persistence (`data/canteen_db.json`) pre-seeded with college canteen favorites.
- **Frontend**: Vanilla HTML5, CSS3 (Modern dark-slate glassmorphism design system), and modular JavaScript (`public/js/app.js`).
- **Zero Native Dependencies**: No C++ compilation issues on Windows Node 24.

---

## 💻 How to Run the Project

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation & Launch

```powershell
# 1. Navigate to the project root directory
cd "d:\Mess Management System"

# 2. Install dependencies
npm.cmd install

# 3. Start the application
npm.cmd start
# (or: node server.js)

# 4. Open in browser
# http://localhost:3000
```

---

## 🎬 College Demo Workflow (For Tomorrow's CEP Presentation)

1. **Student Pre-Order**:
   - Open `http://localhost:3000`
   - Filter by `Snacks` or `Beverages`
   - Click `+ Add` on *Masala Dosa* and *Cold Coffee*
   - Open Cart ➔ Click *Proceed to Checkout*
   - Enter student details and choose slot `12:45 PM`
   - Click *Confirm & Generate Token* ➔ Receive Token `#SC-XXXX`
2. **Kitchen Staff Processing**:
   - Switch to the **Kitchen Staff** tab in the top navigation
   - Locate the newly placed order
   - Click **Accept Order** ➔ Click **Start Preparing** ➔ Click **Mark Ready for Pickup**
3. **Live Student Tracking**:
   - Switch back to the **Live Tracker** tab
   - Observe the 5-stage stepper automatically update to `Ready for Pickup`
4. **Order Collection & Feedback**:
   - Staff marks order as **Collected**
   - Student tracker unlocks the **Rate & Review** prompt
   - Submit a 5-star rating with a comment
5. **Admin Reports & Analytics**:
   - Switch to **Admin Portal**
   - Check updated Revenue, Popular Items chart, and the newly submitted student review!

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/menu` | List all menu items (filterable by category/search) |
| `POST` | `/api/menu` | Add a new menu item |
| `PUT` | `/api/menu/:id` | Update menu item details and stock |
| `PATCH`| `/api/menu/:id/toggle` | Toggle availability or adjust stock |
| `DELETE`| `/api/menu/:id` | Remove a menu item |
| `GET` | `/api/orders` | Retrieve all orders (newest first) |
| `GET` | `/api/orders/:token` | Lookup order by token for live tracking |
| `POST` | `/api/orders` | Create pre-order and generate `#SC-XXXX` token |
| `PATCH`| `/api/orders/:id/status`| Update order status (`Placed` -> `Accepted` -> `Preparing` -> `Ready for Pickup` -> `Collected`) |
| `GET` | `/api/stats` | Analytics summary, revenue, and popular items |
| `POST` | `/api/feedback` | Submit student rating & review |
| `GET` | `/api/feedback` | Retrieve student reviews list |
