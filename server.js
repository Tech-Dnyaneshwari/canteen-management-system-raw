const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'canteen_db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database helper functions with safe file operations
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initialData = { menu: [], orders: [], feedback: [], nextOrderNumber: 1001 };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database file:', err);
    return { menu: [], orders: [], feedback: [], nextOrderNumber: 1001 };
  }
}

function writeDB(data) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing database file:', err);
    return false;
  }
}

// ==========================================
// 1. MENU ENDPOINTS
// ==========================================

// GET /api/menu - Get all menu items
app.get('/api/menu', (req, res) => {
  const db = readDB();
  let items = db.menu || [];
  
  const { category, search, availableOnly } = req.query;
  
  if (category && category !== 'All') {
    items = items.filter(i => i.category.toLowerCase() === category.toLowerCase());
  }
  
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(i => 
      i.name.toLowerCase().includes(q) || 
      i.description.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    );
  }
  
  if (availableOnly === 'true') {
    items = items.filter(i => i.isAvailable && i.stock > 0);
  }
  
  res.json({ success: true, count: items.length, data: items });
});

// POST /api/menu - Add new menu item (Admin)
app.post('/api/menu', (req, res) => {
  const { name, category, price, description, stock, prepTime, badge, image } = req.body;
  
  if (!name || !price || !category) {
    return res.status(400).json({ success: false, message: 'Name, price, and category are required' });
  }
  
  const db = readDB();
  const newItem = {
    id: 'menu-' + Date.now(),
    name: name.trim(),
    category: category.trim(),
    price: Number(price),
    description: (description || '').trim(),
    stock: Number(stock) || 0,
    isAvailable: Number(stock) > 0,
    prepTime: prepTime ? prepTime.trim() : '10 mins',
    badge: (badge || '').trim(),
    image: image || 'food-default'
  };
  
  db.menu.push(newItem);
  writeDB(db);
  
  res.status(201).json({ success: true, message: 'Item added successfully', data: newItem });
});

// PUT /api/menu/:id - Edit menu item (Admin)
app.put('/api/menu/:id', (req, res) => {
  const { id } = req.params;
  const { name, category, price, description, stock, isAvailable, prepTime, badge } = req.body;
  
  const db = readDB();
  const idx = db.menu.findIndex(i => i.id === id);
  
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Menu item not found' });
  }
  
  const existing = db.menu[idx];
  db.menu[idx] = {
    ...existing,
    name: name !== undefined ? name.trim() : existing.name,
    category: category !== undefined ? category.trim() : existing.category,
    price: price !== undefined ? Number(price) : existing.price,
    description: description !== undefined ? description.trim() : existing.description,
    stock: stock !== undefined ? Number(stock) : existing.stock,
    isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : existing.isAvailable,
    prepTime: prepTime !== undefined ? prepTime.trim() : existing.prepTime,
    badge: badge !== undefined ? badge.trim() : existing.badge
  };
  
  writeDB(db);
  res.json({ success: true, message: 'Menu item updated', data: db.menu[idx] });
});

// PATCH /api/menu/:id/toggle - Toggle availability or quick stock adjust
app.patch('/api/menu/:id/toggle', (req, res) => {
  const { id } = req.params;
  const { isAvailable, stockAdjustment } = req.body;
  
  const db = readDB();
  const item = db.menu.find(i => i.id === id);
  
  if (!item) {
    return res.status(404).json({ success: false, message: 'Menu item not found' });
  }
  
  if (isAvailable !== undefined) {
    item.isAvailable = Boolean(isAvailable);
  }
  if (stockAdjustment !== undefined) {
    item.stock = Math.max(0, item.stock + Number(stockAdjustment));
    if (item.stock === 0) item.isAvailable = false;
  }
  
  writeDB(db);
  res.json({ success: true, message: 'Menu item updated', data: item });
});

// DELETE /api/menu/:id - Delete menu item (Admin)
app.delete('/api/menu/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const prevCount = db.menu.length;
  db.menu = db.menu.filter(i => i.id !== id);
  
  if (db.menu.length === prevCount) {
    return res.status(404).json({ success: false, message: 'Menu item not found' });
  }
  
  writeDB(db);
  res.json({ success: true, message: 'Menu item removed' });
});

// ==========================================
// 2. ORDER MANAGEMENT ENDPOINTS
// ==========================================

// GET /api/orders - Get orders with optional status filter
app.get('/api/orders', (req, res) => {
  const db = readDB();
  let orders = db.orders || [];
  
  const { status, search } = req.query;
  
  if (status && status !== 'All') {
    orders = orders.filter(o => o.status.toLowerCase() === status.toLowerCase());
  }
  
  if (search) {
    const q = search.toLowerCase();
    orders = orders.filter(o => 
      o.token.toLowerCase().includes(q) ||
      o.studentName.toLowerCase().includes(q) ||
      (o.rollNumber && o.rollNumber.toLowerCase().includes(q))
    );
  }
  
  // Return sorted by newest first
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ success: true, count: orders.length, data: orders });
});

// GET /api/orders/:tokenOrId - Live tracking lookup
app.get('/api/orders/:tokenOrId', (req, res) => {
  const param = req.params.tokenOrId.trim().toUpperCase();
  const db = readDB();
  
  const order = (db.orders || []).find(o => 
    o.token.toUpperCase() === param || 
    o.token.toUpperCase() === `SC-${param.replace(/^SC-?/, '')}` ||
    o.id.toUpperCase() === param
  );
  
  if (!order) {
    return res.status(404).json({ success: false, message: `Order with token or ID "${req.params.tokenOrId}" not found.` });
  }
  
  res.json({ success: true, data: order });
});

// POST /api/orders - Create Pre-Order (Student)
app.post('/api/orders', (req, res) => {
  const { studentName, rollNumber, phone, pickupSlot, items } = req.body;
  
  if (!studentName || !studentName.trim()) {
    return res.status(400).json({ success: false, message: 'Student name is required' });
  }
  if (!pickupSlot) {
    return res.status(400).json({ success: false, message: 'Pickup slot selection is required' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Your cart is empty' });
  }
  
  const db = readDB();
  
  // Validate stock and compute item totals
  const verifiedItems = [];
  let totalAmount = 0;
  
  for (const cartItem of items) {
    const menuItem = db.menu.find(m => m.id === cartItem.id);
    if (!menuItem) {
      return res.status(400).json({ success: false, message: `Item "${cartItem.name || cartItem.id}" not found in menu.` });
    }
    if (!menuItem.isAvailable || menuItem.stock < cartItem.quantity) {
      return res.status(400).json({ 
        success: false, 
        message: `Sorry, "${menuItem.name}" is out of stock or does not have ${cartItem.quantity} portions available (Available: ${menuItem.stock}).` 
      });
    }
    
    // Decrement stock
    menuItem.stock -= cartItem.quantity;
    if (menuItem.stock <= 0) {
      menuItem.stock = 0;
      menuItem.isAvailable = false;
    }
    
    const subtotal = menuItem.price * cartItem.quantity;
    totalAmount += subtotal;
    
    verifiedItems.push({
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: cartItem.quantity,
      subtotal: subtotal
    });
  }
  
  // Generate unique order token
  const tokenNum = db.nextOrderNumber || 1001;
  const token = `SC-${tokenNum}`;
  db.nextOrderNumber = tokenNum + 1;
  
  const now = new Date().toISOString();
  const newOrder = {
    id: 'ord-' + tokenNum,
    token: token,
    studentName: studentName.trim(),
    rollNumber: (rollNumber || 'N/A').trim(),
    phone: (phone || 'N/A').trim(),
    pickupSlot: pickupSlot,
    paymentMethod: 'Cash at Pickup',
    status: 'Placed',
    createdAt: now,
    totalAmount: totalAmount,
    items: verifiedItems,
    statusHistory: [
      { status: 'Placed', time: now }
    ]
  };
  
  db.orders.unshift(newOrder);
  writeDB(db);
  
  res.status(201).json({ 
    success: true, 
    message: 'Pre-order placed successfully!', 
    data: newOrder 
  });
});

// PATCH /api/orders/:id/status - Update Order Status (Canteen Staff)
app.patch('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const validStatuses = ['Placed', 'Accepted', 'Preparing', 'Ready for Pickup', 'Collected', 'Cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
  }
  
  const db = readDB();
  const order = (db.orders || []).find(o => o.id === id || o.token === id);
  
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  
  const now = new Date().toISOString();
  order.status = status;
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({ status: status, time: now });
  
  writeDB(db);
  
  res.json({ 
    success: true, 
    message: `Order #${order.token} status updated to ${status}`, 
    data: order 
  });
});

// ==========================================
// 3. FEEDBACK & RATING ENDPOINTS
// ==========================================

// POST /api/feedback - Submit feedback on collected order
app.post('/api/feedback', (req, res) => {
  const { orderToken, studentName, rating, comment } = req.body;
  
  if (!orderToken || !rating) {
    return res.status(400).json({ success: false, message: 'Order token and rating (1-5) are required' });
  }
  
  const numRating = Number(rating);
  if (numRating < 1 || numRating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5 stars' });
  }
  
  const db = readDB();
  if (!db.feedback) db.feedback = [];
  
  const newFeedback = {
    id: 'fb-' + Date.now(),
    orderToken: orderToken.trim().toUpperCase(),
    studentName: (studentName || 'Student').trim(),
    rating: numRating,
    comment: (comment || '').trim(),
    createdAt: new Date().toISOString()
  };
  
  db.feedback.unshift(newFeedback);
  writeDB(db);
  
  res.status(201).json({ success: true, message: 'Thank you for your feedback!', data: newFeedback });
});

// GET /api/feedback - Get recent feedback
app.get('/api/feedback', (req, res) => {
  const db = readDB();
  const feedback = db.feedback || [];
  res.json({ success: true, count: feedback.length, data: feedback });
});

// ==========================================
// 4. REPORTS & ANALYTICS ENDPOINT
// ==========================================

// GET /api/stats - Admin Canteen Analytics
app.get('/api/stats', (req, res) => {
  const db = readDB();
  const orders = db.orders || [];
  const menu = db.menu || [];
  const feedback = db.feedback || [];
  
  const totalOrders = orders.length;
  const activeOrders = orders.filter(o => ['Placed', 'Accepted', 'Preparing', 'Ready for Pickup'].includes(o.status)).length;
  const readyOrders = orders.filter(o => o.status === 'Ready for Pickup').length;
  const collectedOrders = orders.filter(o => o.status === 'Collected').length;
  
  // Total Revenue (all non-cancelled orders)
  const totalRevenue = orders
    .filter(o => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    
  // Average Rating
  const avgRating = feedback.length > 0 
    ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1) 
    : '4.8';
    
  // Item sales popularity
  const itemCounts = {};
  orders.forEach(order => {
    if (order.status !== 'Cancelled' && Array.isArray(order.items)) {
      order.items.forEach(it => {
        itemCounts[it.name] = (itemCounts[it.name] || 0) + it.quantity;
      });
    }
  });
  
  const popularItems = Object.entries(itemCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
    
  // Status breakdown
  const statusCounts = {
    Placed: orders.filter(o => o.status === 'Placed').length,
    Accepted: orders.filter(o => o.status === 'Accepted').length,
    Preparing: orders.filter(o => o.status === 'Preparing').length,
    'Ready for Pickup': readyOrders,
    Collected: collectedOrders,
    Cancelled: orders.filter(o => o.status === 'Cancelled').length
  };
  
  res.json({
    success: true,
    data: {
      totalOrders,
      activeOrders,
      readyOrders,
      collectedOrders,
      totalRevenue,
      avgRating,
      totalFeedback: feedback.length,
      popularItems,
      statusCounts,
      totalMenuItems: menu.length,
      lowStockItems: menu.filter(m => m.stock < 10).length
    }
  });
});

// Fallback to SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🍽️  Smart Canteen Management System is LIVE!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📁 Database: ${DB_PATH}`);
  console.log(`=======================================================`);
});
