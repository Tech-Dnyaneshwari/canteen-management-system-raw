/**
 * SMART CANTEEN MANAGEMENT SYSTEM - FRONTEND APPLICATION LOGIC
 * Architecture: Student Pre-Order + Live Tracker + Kitchen Staff Dashboard + Admin Portal
 */

// Global Application State
const state = {
  currentView: 'student',
  currentCategory: 'All',
  searchQuery: '',
  menuItems: [],
  cart: [], // [{ id, name, price, quantity, maxStock, image }]
  trackingToken: null,
  staffOrders: [],
  staffFilter: 'All',
  activeAdminTab: 'reports',
  selectedRating: 5,
  pollingTimer: null
};

// Food icon mapping helper
const foodIcons = {
  dosa: '🥞',
  vadapav: '🍔',
  samosa: '🥟',
  sandwich: '🥪',
  thali: '🍛',
  biryani: '🍚',
  chole: '🥘',
  maggi: '🍜',
  coffee: '☕',
  tea: '🫖',
  lime: '🥤',
  dessert: '🍨',
  default: '🍽️'
};

function getFoodIcon(imageKey, category) {
  if (foodIcons[imageKey]) return foodIcons[imageKey];
  if (category === 'Breakfast') return '🥞';
  if (category === 'Beverages') return '☕';
  if (category === 'Meals') return '🍛';
  if (category === 'Desserts') return '🍨';
  return '🥪';
}

// ==========================================================================
// 1. INITIALIZATION & VIEW NAVIGATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Load saved cart from localStorage if present
  try {
    const savedCart = localStorage.getItem('smart_canteen_cart');
    if (savedCart) state.cart = JSON.parse(savedCart);
  } catch (e) {
    console.warn('Could not parse saved cart', e);
  }

  // Load last active tracking token
  const lastToken = localStorage.getItem('smart_canteen_last_token');
  if (lastToken) {
    state.trackingToken = lastToken;
  }

  // Initial load
  loadMenu();
  updateCartUI();
  updateRecentTokensUI();
  
  // Start background live polling (every 4 seconds)
  startPolling();
});

function switchView(viewName) {
  state.currentView = viewName;

  // Toggle view visibility
  document.querySelectorAll('.app-view').forEach(el => el.classList.remove('active'));
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.add('active');

  // Update navbar tabs
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  const activeTab = document.getElementById(`tab-${viewName}`);
  if (activeTab) activeTab.classList.add('active');

  // Perform view-specific initializations
  if (viewName === 'student') {
    loadMenu();
  } else if (viewName === 'tracking') {
    if (state.trackingToken) {
      lookupOrderByToken(state.trackingToken, true);
    }
  } else if (viewName === 'staff') {
    loadStaffOrders();
  } else if (viewName === 'admin') {
    loadAdminData();
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Background polling for real-time kitchen and tracking synchronization
function startPolling() {
  if (state.pollingTimer) clearInterval(state.pollingTimer);
  state.pollingTimer = setInterval(() => {
    // Silently refresh staff queue if staff view active
    if (state.currentView === 'staff') {
      loadStaffOrders(true);
    }
    // Silently refresh tracking if tracking view active and token selected
    if (state.currentView === 'tracking' && state.trackingToken) {
      lookupOrderByToken(state.trackingToken, true);
    }
    // Update badge count in header
    updateHeaderPendingBadge();
  }, 4000);
}

// ==========================================================================
// 2. STUDENT MENU & CATEGORY FILTERING
// ==========================================================================

async function loadMenu() {
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();
    if (data.success) {
      state.menuItems = data.data;
      renderMenu();
    }
  } catch (err) {
    showToast('Failed to load menu items', 'error');
  }
}

function filterByCategory(category) {
  state.currentCategory = category;
  
  // Update chips UI
  document.querySelectorAll('#category-filter-chips .chip').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-category') === category);
  });
  
  renderMenu();
}

function handleMenuSearch() {
  const input = document.getElementById('menu-search-input');
  state.searchQuery = input.value.trim().toLowerCase();
  
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.style.display = state.searchQuery ? 'block' : 'none';
  
  renderMenu();
}

function clearSearch() {
  const input = document.getElementById('menu-search-input');
  input.value = '';
  state.searchQuery = '';
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  renderMenu();
}

function renderMenu() {
  const grid = document.getElementById('menu-items-grid');
  const countBadge = document.getElementById('menu-count-badge');
  if (!grid) return;

  // Filter items by category & search
  let filtered = state.menuItems;

  if (state.currentCategory !== 'All') {
    filtered = filtered.filter(i => i.category.toLowerCase() === state.currentCategory.toLowerCase());
  }

  if (state.searchQuery) {
    filtered = filtered.filter(i => 
      i.name.toLowerCase().includes(state.searchQuery) ||
      i.description.toLowerCase().includes(state.searchQuery) ||
      i.category.toLowerCase().includes(state.searchQuery)
    );
  }

  if (countBadge) {
    countBadge.innerText = `${filtered.length} Dishes Available`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔍</div>
        <h3>No matching dishes found</h3>
        <p>Try searching for something else or browse another category.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const isOut = !item.isAvailable || item.stock <= 0;
    const isLow = item.stock > 0 && item.stock <= 8;
    const cartItem = state.cart.find(c => c.id === item.id);
    const inCartQty = cartItem ? cartItem.quantity : 0;
    const icon = getFoodIcon(item.image, item.category);

    let stockTag = `<span class="stock-tag in-stock">● In Stock (${item.stock})</span>`;
    if (isOut) {
      stockTag = `<span class="stock-tag out-stock">● Sold Out</span>`;
    } else if (isLow) {
      stockTag = `<span class="stock-tag low-stock">● Few Left (${item.stock})</span>`;
    }

    return `
      <div class="food-card ${isOut ? 'out-of-stock' : ''}">
        <div class="card-visual">
          <span class="food-icon-huge">${icon}</span>
          ${item.badge ? `<span class="card-badge">${item.badge}</span>` : ''}
          <span class="card-preptime">⏱️ ${item.prepTime || '8 mins'}</span>
        </div>

        <div class="card-details">
          <span class="card-category">${item.category}</span>
          <h3 class="card-name">${item.name}</h3>
          <p class="card-desc">${item.description || 'Delicious freshly prepared canteen specialty.'}</p>

          <div class="card-footer-row">
            <div class="card-price-wrap">
              <span class="price-currency">Price</span>
              <span class="price-value">₹${item.price}</span>
              ${stockTag}
            </div>

            <div class="card-action">
              ${isOut ? `
                <button class="add-btn" disabled>Sold Out</button>
              ` : inCartQty > 0 ? `
                <div class="card-qty-control">
                  <button class="qty-btn" onclick="updateCartQuantity('${item.id}', -1)">-</button>
                  <span class="qty-val">${inCartQty}</span>
                  <button class="qty-btn" onclick="updateCartQuantity('${item.id}', 1)">+</button>
                </div>
              ` : `
                <button class="add-btn" onclick="addToCart('${item.id}')">
                  + Add
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================================================
// 3. SHOPPING CART & LOCAL PERSISTENCE
// ==========================================================================

function addToCart(itemId) {
  const menuItem = state.menuItems.find(i => i.id === itemId);
  if (!menuItem || !menuItem.isAvailable || menuItem.stock <= 0) {
    showToast('Item is currently out of stock', 'error');
    return;
  }

  const existing = state.cart.find(c => c.id === itemId);
  if (existing) {
    if (existing.quantity >= menuItem.stock) {
      showToast(`Only ${menuItem.stock} portions available!`, 'info');
      return;
    }
    existing.quantity += 1;
  } else {
    state.cart.push({
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: 1,
      maxStock: menuItem.stock,
      image: menuItem.image
    });
  }

  saveCart();
  updateCartUI();
  renderMenu();
  showToast(`Added ${menuItem.name} to cart`, 'success');
}

function updateCartQuantity(itemId, delta) {
  const itemIdx = state.cart.findIndex(c => c.id === itemId);
  if (itemIdx === -1) return;

  const item = state.cart[itemIdx];
  const menuItem = state.menuItems.find(m => m.id === itemId);
  const maxStock = menuItem ? menuItem.stock : item.maxStock;

  item.quantity += delta;

  if (item.quantity > maxStock) {
    item.quantity = maxStock;
    showToast(`Maximum available portions reached (${maxStock})`, 'info');
  } else if (item.quantity <= 0) {
    state.cart.splice(itemIdx, 1);
  }

  saveCart();
  updateCartUI();
  renderMenu();
}

function saveCart() {
  try {
    localStorage.setItem('smart_canteen_cart', JSON.stringify(state.cart));
  } catch (e) {
    console.warn('Could not save cart', e);
  }
}

function updateCartUI() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Update header cart indicators
  const badge = document.getElementById('cart-badge');
  const totalHeader = document.getElementById('cart-total-header');
  if (badge) badge.innerText = totalItems;
  if (totalHeader) totalHeader.innerText = `₹${totalAmount}`;

  // Update drawer contents
  renderCartDrawer(totalAmount);
}

function renderCartDrawer(totalAmount) {
  const drawerBody = document.getElementById('cart-items-body');
  const billSubtotal = document.getElementById('bill-subtotal');
  const billTotal = document.getElementById('bill-total');
  const checkoutBtn = document.getElementById('btn-proceed-checkout');
  if (!drawerBody) return;

  if (state.cart.length === 0) {
    drawerBody.innerHTML = `
      <div class="cart-empty-message">
        <div class="cart-empty-icon">🛒</div>
        <h4>Your Cart is Empty</h4>
        <p>Explore our menu and add your favorite dishes to pre-order.</p>
      </div>
    `;
    if (billSubtotal) billSubtotal.innerText = '₹0';
    if (billTotal) billTotal.innerText = '₹0';
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  if (checkoutBtn) checkoutBtn.disabled = false;

  drawerBody.innerHTML = state.cart.map(item => `
    <div class="cart-item-row">
      <div class="cart-item-info">
        <span class="cart-item-name">${item.name}</span>
        <span class="cart-item-price">₹${item.price} × ${item.quantity} = ₹${item.price * item.quantity}</span>
      </div>

      <div class="card-qty-control">
        <button class="qty-btn" onclick="updateCartQuantity('${item.id}', -1)">-</button>
        <span class="qty-val">${item.quantity}</span>
        <button class="qty-btn" onclick="updateCartQuantity('${item.id}', 1)">+</button>
      </div>
    </div>
  `).join('');

  if (billSubtotal) billSubtotal.innerText = `₹${totalAmount}`;
  if (billTotal) billTotal.innerText = `₹${totalAmount}`;
}

function toggleCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('drawer-overlay');
  const isActive = drawer.classList.contains('active');

  if (isActive) {
    closeCartDrawer();
  } else {
    openCartDrawer();
  }
}

function openCartDrawer() {
  document.getElementById('cart-drawer').classList.add('active');
  document.getElementById('drawer-overlay').classList.add('active');
}

function closeCartDrawer() {
  document.getElementById('cart-drawer').classList.remove('active');
  document.getElementById('drawer-overlay').classList.remove('active');
}

// ==========================================================================
// 4. CHECKOUT & TOKEN CREATION
// ==========================================================================

function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToast('Please add items to cart first', 'error');
    return;
  }

  closeCartDrawer();

  // Populate preview
  const totalAmount = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const previewContainer = document.getElementById('checkout-items-preview');
  const totalPreview = document.getElementById('checkout-total-preview');

  if (previewContainer) {
    previewContainer.innerHTML = state.cart.map(i => `${i.quantity}x ${i.name}`).join(', ');
  }
  if (totalPreview) {
    totalPreview.innerText = `₹${totalAmount}`;
  }

  document.getElementById('checkout-modal-overlay').classList.add('active');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal-overlay').classList.remove('active');
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  const studentName = document.getElementById('student-name').value.trim();
  const rollNumber = document.getElementById('roll-number').value.trim();
  const phone = document.getElementById('student-phone').value.trim();
  const pickupSlot = document.getElementById('pickup-slot').value;

  if (!studentName || !rollNumber || !pickupSlot) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  const btn = document.getElementById('btn-place-order');
  btn.disabled = true;
  btn.innerText = 'Creating Pre-Order...';

  try {
    const payload = {
      studentName,
      rollNumber,
      phone,
      pickupSlot,
      items: state.cart.map(c => ({ id: c.id, name: c.name, quantity: c.quantity }))
    };

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      showToast(data.message || 'Failed to place order', 'error');
      btn.disabled = false;
      btn.innerText = 'Confirm & Generate Token 🚀';
      return;
    }

    const createdOrder = data.data;

    // Clear cart
    state.cart = [];
    saveCart();
    updateCartUI();
    renderMenu();

    // Save token
    state.trackingToken = createdOrder.token;
    saveRecentToken(createdOrder.token);

    // Close checkout and show success confirmation modal
    closeCheckoutModal();
    showSuccessModal(createdOrder);

  } catch (err) {
    showToast('Server error while placing order', 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Confirm & Generate Token 🚀';
  }
}

function showSuccessModal(order) {
  document.getElementById('success-token-code').innerText = `#${order.token}`;
  document.getElementById('success-token-slot').innerText = order.pickupSlot;
  document.getElementById('success-total-amount').innerText = `₹${order.totalAmount}`;
  document.getElementById('success-modal-overlay').classList.add('active');
}

function closeSuccessModal() {
  document.getElementById('success-modal-overlay').classList.remove('active');
}

function viewPlacedOrderInTracker() {
  closeSuccessModal();
  switchView('tracking');
}

function saveRecentToken(token) {
  try {
    let recents = JSON.parse(localStorage.getItem('smart_canteen_recent_tokens') || '[]');
    recents = recents.filter(t => t !== token);
    recents.unshift(token);
    recents = recents.slice(0, 5);
    localStorage.setItem('smart_canteen_recent_tokens', JSON.stringify(recents));
    localStorage.setItem('smart_canteen_last_token', token);
    updateRecentTokensUI();
  } catch (e) {
    console.warn('Could not save recent token', e);
  }
}

function updateRecentTokensUI() {
  const container = document.getElementById('recent-tokens-list');
  if (!container) return;

  try {
    const recents = JSON.parse(localStorage.getItem('smart_canteen_recent_tokens') || '[]');
    if (recents.length === 0) {
      container.innerHTML = `
        <span style="font-size: 0.8rem; color: var(--text-dim);">Quick Demo Tokens:</span>
        <button class="recent-token-pill" onclick="lookupOrderByToken('SC-1001')">#SC-1001</button>
        <button class="recent-token-pill" onclick="lookupOrderByToken('SC-1002')">#SC-1002</button>
        <button class="recent-token-pill" onclick="lookupOrderByToken('SC-1003')">#SC-1003</button>
      `;
      return;
    }

    container.innerHTML = `
      <span style="font-size: 0.8rem; color: var(--text-dim);">Your Recent Tokens:</span>
      ${recents.map(t => `<button class="recent-token-pill" onclick="lookupOrderByToken('${t}')">#${t}</button>`).join('')}
    `;
  } catch (e) {
    console.warn(e);
  }
}

// ==========================================================================
// 5. LIVE ORDER TRACKING (5 STATUSES & VISUAL STEPPER)
// ==========================================================================

function lookupOrderByInput() {
  const input = document.getElementById('tracking-token-input');
  const token = input.value.trim();
  if (!token) {
    showToast('Please enter an order token', 'info');
    return;
  }
  lookupOrderByToken(token);
}

async function lookupOrderByToken(token, silent = false) {
  try {
    const cleanToken = token.trim().toUpperCase();
    const res = await fetch(`/api/orders/${cleanToken}`);
    const data = await res.json();

    if (!data.success) {
      if (!silent) showToast(data.message || 'Order not found', 'error');
      return;
    }

    const order = data.data;
    state.trackingToken = order.token;
    saveRecentToken(order.token);

    renderTrackingDetails(order);

  } catch (err) {
    if (!silent) showToast('Error tracking order', 'error');
  }
}

function renderTrackingDetails(order) {
  const detailsCard = document.getElementById('tracking-details-card');
  const emptyState = document.getElementById('tracking-empty-state');
  if (!detailsCard) return;

  detailsCard.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';

  // Header banner info
  document.getElementById('track-token-display').innerText = `#${order.token}`;
  const placedTime = order.statusHistory && order.statusHistory.length > 0
    ? new Date(order.statusHistory[0].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Recently';
  document.getElementById('track-time-display').innerText = `Placed at ${placedTime}`;
  
  const statusPill = document.getElementById('track-status-pill');
  statusPill.innerText = order.status;
  statusPill.className = `current-status-badge status-${order.status.replace(/\s+/g, '')}`;

  document.getElementById('track-slot-display').innerText = order.pickupSlot;

  // Render 5-step stepper
  updateStepperUI(order);

  // Items list
  const itemsContainer = document.getElementById('track-items-list');
  if (itemsContainer && Array.isArray(order.items)) {
    itemsContainer.innerHTML = order.items.map(it => `
      <div class="summary-item-row">
        <span><strong>${it.quantity}x</strong> ${it.name}</span>
        <span>₹${it.subtotal || (it.price * it.quantity)}</span>
      </div>
    `).join('');
  }

  document.getElementById('track-total-amount').innerText = `₹${order.totalAmount}`;
  document.getElementById('track-student-name').innerText = order.studentName;
  document.getElementById('track-roll-number').innerText = order.rollNumber || 'N/A';
  document.getElementById('track-phone').innerText = order.phone || 'N/A';
  document.getElementById('track-slot-info').innerText = order.pickupSlot;

  // Feedback prompt: show if order is Collected
  const fbPrompt = document.getElementById('tracking-feedback-prompt');
  if (fbPrompt) {
    fbPrompt.style.display = order.status === 'Collected' ? 'flex' : 'none';
  }
}

function updateStepperUI(order) {
  const stages = ['Placed', 'Accepted', 'Preparing', 'Ready for Pickup', 'Collected'];
  const currentIdx = stages.indexOf(order.status);

  // Map of timestamps from statusHistory
  const timeMap = {};
  if (order.statusHistory) {
    order.statusHistory.forEach(h => {
      timeMap[h.status] = new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
  }

  stages.forEach((stage, idx) => {
    const stepId = stage === 'Ready for Pickup' ? 'step-Ready' : `step-${stage}`;
    const stepElem = document.getElementById(stepId);
    const timeElem = document.getElementById(stage === 'Ready for Pickup' ? 'time-Ready' : `time-${stage}`);

    if (timeElem) {
      timeElem.innerText = timeMap[stage] || (idx <= currentIdx ? 'Done' : '--');
    }

    if (stepElem) {
      stepElem.classList.remove('completed', 'current');
      if (idx < currentIdx) {
        stepElem.classList.add('completed');
      } else if (idx === currentIdx) {
        stepElem.classList.add('current');
      }
    }

    // Connectors
    if (idx < stages.length - 1) {
      const conn = document.getElementById(`connector-${idx + 1}`);
      if (conn) {
        conn.classList.toggle('filled', idx < currentIdx);
      }
    }
  });
}

// ==========================================================================
// 6. CANTEEN STAFF KITCHEN DASHBOARD
// ==========================================================================

async function loadStaffOrders(silent = false) {
  try {
    const res = await fetch('/api/orders');
    const data = await res.json();
    if (data.success) {
      state.staffOrders = data.data;
      renderStaffDashboard();
      updateHeaderPendingBadge();
    }
  } catch (err) {
    if (!silent) showToast('Failed to load kitchen orders', 'error');
  }
}

function filterStaffOrders(filter) {
  state.staffFilter = filter;
  document.querySelectorAll('.staff-filter-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
  });
  renderStaffDashboard();
}

function renderStaffDashboard() {
  const container = document.getElementById('staff-orders-grid');
  if (!container) return;

  // Counts for tabs
  const allActive = state.staffOrders.filter(o => ['Placed', 'Accepted', 'Preparing', 'Ready for Pickup'].includes(o.status));
  const placed = state.staffOrders.filter(o => o.status === 'Placed');
  const accepted = state.staffOrders.filter(o => o.status === 'Accepted');
  const preparing = state.staffOrders.filter(o => o.status === 'Preparing');
  const ready = state.staffOrders.filter(o => o.status === 'Ready for Pickup');

  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  setTxt('staff-count-all', allActive.length);
  setTxt('staff-count-placed', placed.length);
  setTxt('staff-count-accepted', accepted.length);
  setTxt('staff-count-preparing', preparing.length);
  setTxt('staff-count-ready', ready.length);

  // Filter orders according to selected tab
  let displayed = state.staffOrders;
  if (state.staffFilter === 'All') {
    displayed = allActive;
  } else {
    displayed = state.staffOrders.filter(o => o.status === state.staffFilter);
  }

  if (displayed.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md);">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">✨</div>
        <h3>No ${state.staffFilter === 'All' ? 'active' : state.staffFilter} orders in queue</h3>
        <p>Kitchen is all caught up!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = displayed.map(order => {
    const elapsedMinutes = Math.floor((new Date() - new Date(order.createdAt)) / 60000);
    const timeText = elapsedMinutes < 1 ? 'Just now' : `${elapsedMinutes}m ago`;

    // Action button depending on current state
    let actionButtons = '';
    if (order.status === 'Placed') {
      actionButtons = `
        <button class="btn-kitchen-action btn-primary" onclick="advanceOrderStatus('${order.id}', 'Accepted')">
          Accept Order 👍
        </button>
      `;
    } else if (order.status === 'Accepted') {
      actionButtons = `
        <button class="btn-kitchen-action btn-secondary" onclick="advanceOrderStatus('${order.id}', 'Preparing')">
          Start Preparing 🍳
        </button>
      `;
    } else if (order.status === 'Preparing') {
      actionButtons = `
        <button class="btn-kitchen-action" style="background: #10b981; color: #000;" onclick="advanceOrderStatus('${order.id}', 'Ready for Pickup')">
          Mark Ready for Pickup 🔔
        </button>
      `;
    } else if (order.status === 'Ready for Pickup') {
      actionButtons = `
        <button class="btn-kitchen-action" style="background: #3b82f6; color: #fff;" onclick="advanceOrderStatus('${order.id}', 'Collected')">
          Hand Over & Collected 🎉
        </button>
      `;
    } else {
      actionButtons = `
        <span style="font-size: 0.8rem; color: var(--text-dim); text-align: center;">Order Completed</span>
      `;
    }

    return `
      <div class="kitchen-card">
        <div class="kitchen-card-header">
          <div class="k-token-wrap">
            <span class="k-token-num">#${order.token}</span>
            <span class="k-time-elapsed">${timeText}</span>
          </div>
          <span class="k-status-badge current-status-badge status-${order.status.replace(/\s+/g, '')}">${order.status}</span>
        </div>

        <div class="k-student-info">
          <span class="k-student-name">${order.studentName}</span>
          <span class="k-student-roll">Roll: ${order.rollNumber || 'N/A'} • ${order.phone || ''}</span>
          <div><span class="k-slot-badge">🕒 Pickup: ${order.pickupSlot}</span></div>
        </div>

        <div class="k-items-list">
          ${order.items.map(it => `
            <div class="k-item-row">
              <span><span class="k-item-qty">${it.quantity}x</span> ${it.name}</span>
            </div>
          `).join('')}
        </div>

        <div class="k-actions">
          ${actionButtons}
        </div>
      </div>
    `;
  }).join('');
}

async function advanceOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Status updated to "${newStatus}"`, 'success');
      loadStaffOrders();
    } else {
      showToast(data.message || 'Status update failed', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to server', 'error');
  }
}

function updateHeaderPendingBadge() {
  const pendingBadge = document.getElementById('staff-pending-count');
  if (!pendingBadge) return;
  fetch('/api/orders')
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        const activeCount = data.data.filter(o => ['Placed', 'Accepted', 'Preparing'].includes(o.status)).length;
        pendingBadge.innerText = activeCount;
      }
    })
    .catch(() => {});
}

// ==========================================================================
// 7. ADMIN DASHBOARD (CRUD & REPORTS / ANALYTICS)
// ==========================================================================

function switchAdminTab(tabName) {
  state.activeAdminTab = tabName;
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(`atab-${tabName}`).classList.add('active');

  document.querySelectorAll('.admin-subview').forEach(v => v.classList.remove('active'));
  document.getElementById(`admin-subview-${tabName}`).classList.add('active');

  loadAdminData();
}

async function loadAdminData() {
  try {
    // 1. Stats & KPIs
    const statsRes = await fetch('/api/stats');
    const statsData = await statsRes.json();
    if (statsData.success) {
      renderAdminKPIs(statsData.data);
    }

    // 2. Menu Table
    const menuRes = await fetch('/api/menu');
    const menuData = await menuRes.json();
    if (menuData.success) {
      renderAdminMenuTable(menuData.data);
    }

    // 3. Feedback
    const fbRes = await fetch('/api/feedback');
    const fbData = await fbRes.json();
    if (fbData.success) {
      renderAdminFeedback(fbData.data);
    }

  } catch (err) {
    console.error('Error loading admin data', err);
  }
}

function renderAdminKPIs(stats) {
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

  setTxt('kpi-revenue', `₹${stats.totalRevenue}`);
  setTxt('kpi-total-orders', stats.totalOrders);
  setTxt('kpi-active-orders', stats.activeOrders);
  setTxt('kpi-rating', `${stats.avgRating} / 5`);
  setTxt('kpi-feedback-count', `Based on ${stats.totalFeedback} reviews`);

  // Popular items bars
  const popContainer = document.getElementById('popular-items-container');
  if (popContainer && stats.popularItems) {
    const maxCount = stats.popularItems.length > 0 ? stats.popularItems[0].count : 1;
    popContainer.innerHTML = stats.popularItems.map(item => {
      const pct = Math.round((item.count / maxCount) * 100);
      return `
        <div class="bar-row">
          <div class="bar-labels">
            <span><strong>${item.name}</strong></span>
            <span>${item.count} ordered</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('') || '<p style="color: var(--text-muted);">No sales data yet.</p>';
  }

  // Status breakdown
  const statusContainer = document.getElementById('status-distribution-container');
  if (statusContainer && stats.statusCounts) {
    statusContainer.innerHTML = Object.entries(stats.statusCounts).map(([status, count]) => `
      <div class="status-stat-box">
        <span class="status-stat-label">${status}</span>
        <span class="status-stat-count">${count}</span>
      </div>
    `).join('');
  }
}

function renderAdminMenuTable(items) {
  const tbody = document.getElementById('admin-menu-tbody');
  if (!tbody) return;

  tbody.innerHTML = items.map(item => {
    const icon = getFoodIcon(item.image, item.category);
    return `
      <tr>
        <td>
          <div class="item-name-cell">
            <span class="item-table-icon">${icon}</span>
            <div class="item-table-meta">
              <strong>${item.name}</strong>
              <span>${item.prepTime || '8 mins'} • ${item.badge || 'Standard'}</span>
            </div>
          </div>
        </td>
        <td><span class="chip" style="font-size: 0.75rem;">${item.category}</span></td>
        <td><strong>₹${item.price}</strong></td>
        <td>
          <input type="number" value="${item.stock}" min="0" style="width: 60px; background: var(--bg-surface); color: #fff; border: 1px solid var(--border-card); padding: 4px 6px; border-radius: 4px;" onchange="updateStockQuick('${item.id}', this.value)">
        </td>
        <td>
          ${item.stock <= 0 ? '<span class="stock-tag out-stock">Sold Out</span>' : '<span class="stock-tag in-stock">Available</span>'}
        </td>
        <td>
          <label class="switch">
            <input type="checkbox" ${item.isAvailable && item.stock > 0 ? 'checked' : ''} onchange="toggleAvailability('${item.id}', this.checked)">
            <span class="slider"></span>
          </label>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group">
            <button class="btn btn-outline btn-sm" onclick="openEditMenuModal('${item.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteMenuItem('${item.id}', '${item.name}')">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterAdminMenuTable() {
  const q = document.getElementById('admin-menu-search').value.toLowerCase();
  const rows = document.querySelectorAll('#admin-menu-tbody tr');
  rows.forEach(r => {
    r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
  });
}

async function toggleAvailability(id, isAvailable) {
  try {
    await fetch(`/api/menu/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable })
    });
    showToast('Menu item availability updated', 'info');
    loadMenu();
  } catch (err) {
    showToast('Failed to toggle availability', 'error');
  }
}

async function updateStockQuick(id, newStock) {
  try {
    await fetch(`/api/menu/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: Number(newStock) })
    });
    showToast('Stock quantity updated', 'success');
    loadMenu();
    loadAdminData();
  } catch (err) {
    showToast('Failed to update stock', 'error');
  }
}

async function deleteMenuItem(id, name) {
  if (!confirm(`Are you sure you want to remove "${name}" from the canteen menu?`)) return;
  try {
    const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(`Removed "${name}" from menu`, 'info');
      loadMenu();
      loadAdminData();
    }
  } catch (err) {
    showToast('Failed to delete item', 'error');
  }
}

// Menu Add/Edit Modal
function openAddMenuModal() {
  document.getElementById('menu-item-id').value = '';
  document.getElementById('menu-modal-title').innerText = 'Add New Menu Item';
  document.getElementById('menu-form').reset();
  document.getElementById('menu-modal-overlay').classList.add('active');
}

function openEditMenuModal(id) {
  const item = state.menuItems.find(i => i.id === id);
  if (!item) return;

  document.getElementById('menu-item-id').value = item.id;
  document.getElementById('menu-modal-title').innerText = 'Edit Menu Item';
  document.getElementById('item-name').value = item.name;
  document.getElementById('item-category').value = item.category;
  document.getElementById('item-price').value = item.price;
  document.getElementById('item-stock').value = item.stock;
  document.getElementById('item-preptime').value = item.prepTime || '8 mins';
  document.getElementById('item-badge').value = item.badge || '';
  document.getElementById('item-desc').value = item.description || '';

  document.getElementById('menu-modal-overlay').classList.add('active');
}

function closeMenuModal() {
  document.getElementById('menu-modal-overlay').classList.remove('active');
}

async function handleMenuFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('menu-item-id').value;
  const payload = {
    name: document.getElementById('item-name').value,
    category: document.getElementById('item-category').value,
    price: Number(document.getElementById('item-price').value),
    stock: Number(document.getElementById('item-stock').value),
    prepTime: document.getElementById('item-preptime').value,
    badge: document.getElementById('item-badge').value,
    description: document.getElementById('item-desc').value
  };

  try {
    let res;
    if (id) {
      res = await fetch(`/api/menu/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (data.success) {
      showToast(id ? 'Menu item updated' : 'Menu item added', 'success');
      closeMenuModal();
      loadMenu();
      loadAdminData();
    } else {
      showToast(data.message || 'Error saving item', 'error');
    }
  } catch (err) {
    showToast('Failed to save menu item', 'error');
  }
}

function renderAdminFeedback(feedback) {
  const container = document.getElementById('admin-feedback-container');
  const countBadge = document.getElementById('admin-feedback-total');
  if (!container) return;

  if (countBadge) countBadge.innerText = `${feedback.length} Reviews`;

  if (feedback.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1;">No feedback submitted yet.</p>';
    return;
  }

  container.innerHTML = feedback.map(fb => `
    <div class="fb-card">
      <div class="fb-card-top">
        <span class="fb-student-title">${fb.studentName}</span>
        <span class="fb-stars-display">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</span>
      </div>
      <p class="fb-comment-text">"${fb.comment || 'Great experience!'}"</p>
      <div class="fb-meta-bottom">
        <span>Token: <strong>#${fb.orderToken}</strong></span>
        <span>${new Date(fb.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  `).join('');
}

// ==========================================================================
// 8. STUDENT FEEDBACK & RATING (ON COLLECTED ORDERS)
// ==========================================================================

function openFeedbackModalForCurrentOrder() {
  if (!state.trackingToken) return;
  document.getElementById('feedback-order-token').value = state.trackingToken;
  document.getElementById('feedback-token-label').innerText = `#${state.trackingToken}`;
  setRating(5);
  document.getElementById('feedback-modal-overlay').classList.add('active');
}

function closeFeedbackModal() {
  document.getElementById('feedback-modal-overlay').classList.remove('active');
}

function setRating(rating) {
  state.selectedRating = rating;
  const stars = document.querySelectorAll('#star-rating-selector .star-btn');
  stars.forEach((s, idx) => {
    s.classList.toggle('active', idx < rating);
  });

  const hints = {
    1: '1 Star - Needs Improvement',
    2: '2 Stars - Fair',
    3: '3 Stars - Good',
    4: '4 Stars - Very Good',
    5: '5 Stars - Excellent Food & Service!'
  };
  document.getElementById('rating-text-hint').innerText = hints[rating] || '';
}

async function handleFeedbackSubmit(e) {
  e.preventDefault();

  const token = document.getElementById('feedback-order-token').value;
  const name = document.getElementById('feedback-name').value.trim() || 'Student';
  const comment = document.getElementById('feedback-comment').value.trim();

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderToken: token,
        studentName: name,
        rating: state.selectedRating,
        comment: comment
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Thank you for rating your meal!', 'success');
      closeFeedbackModal();
      document.getElementById('feedback-form').reset();
    } else {
      showToast(data.message || 'Failed to submit rating', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to server', 'error');
  }
}

// ==========================================================================
// 9. TOAST NOTIFICATIONS HELPER
// ==========================================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '✅',
    error: '⚠️',
    info: 'ℹ️'
  };

  toast.innerHTML = `
    <span>${icons[type] || 'ℹ️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}
