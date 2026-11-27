// ===== Elementos principales =====
const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginSubmit = document.getElementById('login-submit');

let charts = { salesDay: null, topProducts: null, methods: null };
let currentDays = 7;
let currentDashboardData = null;

function setTheme(theme, persist = true) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const button = document.getElementById('theme-toggle');
  if (button) {
    const label = dark ? 'Día' : 'Noche';
    const action = dark ? 'Activar tema claro' : 'Activar tema nocturno';
    button.setAttribute('aria-label', action);
    button.setAttribute('title', action);
    button.setAttribute('aria-pressed', String(dark));
    document.getElementById('theme-toggle-label').textContent = label;
    document.getElementById('theme-toggle-icon').innerHTML = dark
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'
      : '<path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8a8.6 8.6 0 1 0 11.6 11.6Z"/>';
  }
  if (persist) {
    try { localStorage.setItem('hotel_theme', dark ? 'dark' : 'light'); } catch { /* tema se mantiene en esta sesión */ }
  }
  if (currentDashboardData && typeof Chart !== 'undefined') renderDashboardCharts(currentDashboardData);
}

let savedTheme = 'light';
try { savedTheme = localStorage.getItem('hotel_theme') === 'dark' ? 'dark' : 'light'; } catch { /* usar tema claro si no hay almacenamiento */ }
setTheme(savedTheme, false);
document.getElementById('theme-toggle').addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
document.getElementById('refresh-panel').addEventListener('click', () => window.location.reload());

// ===== Arranque =====
init();

async function init() {
  if (Api.getToken()) {
    try {
      const user = await Api.me();
      Api.setUser(user);
      showApp(user);
      return;
    } catch {
      Api.clearToken();
    }
  }
  showLogin();
}

function showLogin() {
  loginScreen.hidden = false;
  appShell.hidden = true;
}

function showApp(user) {
  loginScreen.hidden = true;
  appShell.hidden = false;
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-email').textContent = user.email || '';
  document.getElementById('user-role').textContent = ({ admin: 'Administrador', recepcionista: 'Recepcionista', limpieza: 'Limpieza', mantenimiento: 'Mantenimiento' })[user.role] || user.role;
  document.getElementById('user-avatar').textContent = (user.name || '?').trim().charAt(0).toLocaleUpperCase('es-SV');

  const isAdmin = user.role === 'admin';
  document.querySelectorAll('.nav-item[data-role]').forEach((item) => {
    item.hidden = !item.dataset.role.split(',').includes(user.role);
  });
  document.querySelectorAll('[data-nav-group]').forEach((group) => {
    group.hidden = !group.querySelector('.nav-item:not([hidden])');
  });
  const mobileNav = document.getElementById('mobile-nav');
  mobileNav.innerHTML = '<option value="">Ir a una sección…</option>';
  document.querySelectorAll('[data-nav-group]:not([hidden])').forEach((group) => {
    const optionGroup = document.createElement('optgroup');
    optionGroup.label = group.querySelector('.nav-group-title').textContent.trim();
    group.querySelectorAll('.nav-item:not([hidden])').forEach((item) => {
      const option = document.createElement('option'); option.value = item.dataset.view; option.textContent = item.textContent.trim(); optionGroup.appendChild(option);
    });
    mobileNav.appendChild(optionGroup);
  });
  document.getElementById('new-product-btn').hidden = !isAdmin;
  document.getElementById('new-room-btn').hidden = !isAdmin;
  document.getElementById('new-rate-btn').hidden = !isAdmin;
  document.getElementById('new-category-btn').hidden = !isAdmin;
  document.getElementById('new-user-btn').hidden = !isAdmin;
  document.getElementById('new-supplier-btn').hidden = !isAdmin;
  document.getElementById('new-purchase-btn').hidden = !isAdmin;
  document.getElementById('new-guest-btn').hidden = !['admin', 'recepcionista'].includes(user.role);
  document.getElementById('new-reservation-btn').hidden = !['admin', 'recepcionista'].includes(user.role);
  document.getElementById('new-task-btn').hidden = !['admin', 'recepcionista'].includes(user.role);
  document.getElementById('task-filter-type').hidden = !['admin', 'recepcionista'].includes(user.role);
  const closedStayFilter = document.querySelector('#stay-filter-status option[value="finalizada"]');
  if (closedStayFilter) closedStayFilter.hidden = !isAdmin;

  if (isAdmin) {
    showView('dashboard');
    loadDashboard();
    loadCategoriesIntoForm();
  } else {
    showView(user.role === 'limpieza' || user.role === 'mantenimiento' ? 'tareas' : 'habitaciones');
  }
}

// ===== Login =====
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  loginSubmit.disabled = true;
  loginSubmit.textContent = 'Entrando…';

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const result = await Api.login(email, password);
    Api.setToken(result.token);
    Api.setUser(result.user);
    showApp(result.user);
  } catch (err) {
    loginError.textContent = err.message;
    loginError.hidden = false;
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = 'Entrar';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  try { await Api.logout(); } catch { /* ignoramos: igual limpiamos el lado local */ }
  Api.clearToken();
  localStorage.removeItem('lopes_user');
  showLogin();
});

// ===== Navegación entre vistas =====
function showView(viewName) {
  const btn = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.nav-item').forEach((b) => b.removeAttribute('aria-current'));
  btn.setAttribute('aria-current', 'page');
  document.querySelectorAll('.view').forEach((v) => (v.hidden = true));
  document.getElementById(`view-${viewName}`).hidden = false;
  document.getElementById('view-title').textContent = btn.textContent.trim();
  const descriptions = {
    dashboard: 'Resumen de actividad y control del hotel.', habitaciones: 'Consulta disponibilidad, ocupación y tareas por habitación.', estadias: 'Entradas activas, cargos y salidas de huéspedes.',
    tarifas: 'Precios vigentes para reservas y estadías.', catalogo: 'Productos, precios y existencias actuales.', categorias: 'Organiza los productos del hotel.', ventas: 'Ventas registradas desde caja y estadías.', gastos: 'Gastos operativos registrados en los turnos.',
    compras: 'Compras de inventario y proveedores.', turnos: 'Revisa cierres, montos esperados y diferencias.', usuarios: 'Cuentas del equipo y niveles de acceso.', huespedes: 'Busca y actualiza la información de los huéspedes.',
    reservas: 'Programa ingresos y confirma el check-in.', tareas: 'Asigna y actualiza tareas de limpieza y mantenimiento.', caja: 'Abre el turno, registra operaciones y concilia el efectivo.', inventario: 'Trazabilidad de entradas, salidas y ajustes de stock.', acerca: 'Guía de funcionamiento, módulos y permisos del panel.',
  };
  document.getElementById('view-description').textContent = descriptions[viewName] || '';
  document.getElementById('mobile-nav').value = viewName;

  if (viewName === 'catalogo') loadProducts();
  if (viewName === 'habitaciones') loadRooms();
  if (viewName === 'estadias') loadStays();
  if (viewName === 'tarifas') loadRates();
  if (viewName === 'compras') {
    loadPurchases();
    loadSuppliers();
    loadProductsIntoPurchaseForm();
    loadSuppliersIntoPurchaseForm();
  }
  if (viewName === 'turnos') loadShifts();
  if (viewName === 'categorias') loadCategories();
  if (viewName === 'ventas') loadSales();
  if (viewName === 'gastos') loadExpenses();
  if (viewName === 'usuarios') loadUsers();
  if (viewName === 'huespedes') loadGuests();
  if (viewName === 'reservas') loadReservations();
  if (viewName === 'tareas') loadTasks();
  if (viewName === 'caja') loadCurrentShift();
  if (viewName === 'inventario') { loadMovementProducts(); loadInventoryMovements(); }
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('disabled')) return;
    showView(btn.dataset.view);
  });
});
document.querySelectorAll('[data-go-view]').forEach((btn) => btn.addEventListener('click', () => showView(btn.dataset.goView)));
document.getElementById('mobile-nav').addEventListener('change', (e) => { if (e.target.value) showView(e.target.value); });

// ===== Dashboard =====
document.querySelectorAll('.period-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentDays = Number(btn.dataset.days);
    loadDashboard();
  });
});

async function loadDashboard() {
  try {
    const data = await Api.dashboard(currentDays);
    currentDashboardData = data;
    renderKpis(data.totals);
    renderLowStock(data.low_stock);
    renderOpenShifts(data.open_shifts);
    if (typeof Chart === 'undefined') {
      console.error('Chart.js no se cargó: revisa que exista js/chart.umd.min.js');
      return;
    }
    renderDashboardCharts(data);
  } catch (err) {
    document.getElementById('kpi-sales').textContent = '—';
    console.error('Error cargando el dashboard:', err.message);
  }
}

function renderDashboardCharts(data) {
  renderSalesByDayChart(data.sales_by_day);
  renderTopProductsChart(data.top_products);
  renderMethodsChart(data.sales_by_method);
}

function themeColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const currencyFormatter = new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' });
function money(n) { return currencyFormatter.format(Number(n) || 0); }

// Escapa texto antes de insertarlo con innerHTML (evita inyección de HTML/JS).
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderKpis(totals) {
  document.getElementById('kpi-sales').textContent = money(totals.sales);
  document.getElementById('kpi-sales-count').textContent = totals.sales_count;
  document.getElementById('kpi-expenses').textContent = money(totals.expenses);
  document.getElementById('kpi-purchases').textContent = money(totals.purchases);
}

function renderSalesByDayChart(salesByDay) {
  const ctx = document.getElementById('chart-sales-day');
  const labels = salesByDay.map((d) => d.date.slice(5)); // MM-DD
  const totals = salesByDay.map((d) => d.total);

  if (charts.salesDay) charts.salesDay.destroy();
  charts.salesDay = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Ventas',
        data: totals,
        borderColor: themeColor('--chart-primary'),
        backgroundColor: themeColor('--chart-fill'),
        tension: 0.3,
        fill: true,
        pointBackgroundColor: themeColor('--chart-primary'),
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (item) => `Ventas: ${money(item.parsed.y)}` } } },
      scales: {
        x: { ticks: { color: themeColor('--chart-muted') }, grid: { color: themeColor('--chart-grid') } },
        y: { ticks: { color: themeColor('--chart-muted'), callback: (value) => money(value) }, grid: { color: themeColor('--chart-grid') }, beginAtZero: true },
      },
    },
  });
}

function renderTopProductsChart(topProducts) {
  const ctx = document.getElementById('chart-top-products');
  const labels = topProducts.map((p) => p.name);
  const quantities = topProducts.map((p) => Number(p.quantity));

  if (charts.topProducts) charts.topProducts.destroy();
  charts.topProducts = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Unidades vendidas', data: quantities, backgroundColor: themeColor('--chart-accent') }],
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: themeColor('--chart-muted') }, grid: { color: themeColor('--chart-grid') }, beginAtZero: true },
        y: { ticks: { color: themeColor('--chart-muted') }, grid: { display: false } },
      },
    },
  });
}

function renderLowStock(items) {
  const list = document.getElementById('low-stock-list');
  if (!items.length) {
    list.innerHTML = '<li class="muted">Sin productos con stock bajo.</li>';
    return;
  }
  list.innerHTML = items
    .map((p) => `<li><span>${esc(p.name)}</span><span class="stock-low">${p.stock} / mín. ${p.min_stock}</span></li>`)
    .join('');
}

function renderOpenShifts(shifts) {
  const list = document.getElementById('open-shifts-list');
  if (!shifts.length) {
    list.innerHTML = '<li class="muted">No hay turnos abiertos.</li>';
    return;
  }
  list.innerHTML = shifts
    .map((s) => `<li><span>${esc(s.user.name)}</span><span class="muted">desde ${new Date(s.opened_at).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', timeZone: 'America/El_Salvador' })}</span></li>`)
    .join('');
}

// ===== Catálogo =====
async function loadProducts(query = '') {
  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="muted">Cargando…</td></tr>';
  try {
    const products = await Api.products(query, isAdmin());
    productsById = Object.fromEntries(products.map((p) => [p.id, p]));
    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted">No se encontraron productos.</td></tr>';
      return;
    }
    tbody.innerHTML = products
      .map((p) => `
        <tr>
          <td>${esc(p.name)}</td>
          <td>${p.category ? esc(p.category.name) : '—'}</td>
          <td>${money(p.price)}</td>
          <td class="${p.stock <= p.min_stock ? 'stock-low' : ''}">${p.stock} / ${p.max_stock ?? '—'}</td>
          <td><span class="status-badge ${p.active ? 'status-active' : 'status-inactive'}">${p.active ? 'Activo' : 'Inactivo'}</span></td>
          ${isAdmin() ? `<td class="row-actions">
            <button class="btn-secondary btn-small" data-edit-product="${p.id}">Editar</button>
            ${p.active ? `<button class="btn-secondary btn-small" data-adjust-product="${p.id}">Ajustar stock</button>` : ''}
            ${p.active ? `<button class="btn-secondary btn-small btn-danger" data-delete-product="${p.id}">Desactivar</button>` : `<button class="btn-secondary btn-small" data-activate-product="${p.id}">Activar</button>`}
          </td>` : '<td></td>'}
        </tr>
      `)
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Error al cargar: ${esc(err.message)}</td></tr>`;
  }
}

let searchDebounce;
document.getElementById('product-search').addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadProducts(e.target.value), 350);
});

// ===== Modal: nuevo producto =====
const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
const productFormError = document.getElementById('product-form-error');
const packageFields = document.getElementById('pf-package-fields');
function updateInitialProductPrice() {
  if (editingProductId) return;
  const packageCost = Number(document.getElementById('pf-package-cost').value) || 0;
  const units = Number(document.getElementById('pf-units').value) || 0;
  const packages = Number(document.getElementById('pf-packages').value) || 0;
  document.getElementById('pf-price').value = units ? (Math.round((packageCost / units) * 1.3 * 100) / 100).toFixed(2) : '';
  document.getElementById('pf-stock').value = packages * units;
  const maxField = document.getElementById('pf-max-stock');
  if (Number(maxField.value) < packages * units) maxField.value = packages * units;
  document.getElementById('pf-min-stock').value = Math.ceil(Number(maxField.value) * 0.2);
}
['pf-package-cost', 'pf-packages', 'pf-units', 'pf-max-stock'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateInitialProductPrice);
});

document.getElementById('new-product-btn').addEventListener('click', () => openProductModal());

document.getElementById('product-cancel-btn').addEventListener('click', () => {
  productModal.hidden = true;
});

productModal.addEventListener('click', (e) => {
  if (e.target === productModal) productModal.hidden = true;
});

async function loadCategoriesIntoForm() {
  const select = document.getElementById('pf-category');
  try {
    const categories = await Api.categories();
    select.innerHTML = categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  } catch {
    select.innerHTML = '<option value="">No se pudieron cargar las categorías</option>';
  }
}

async function loadSuppliersIntoProductForm() {
  const select = document.getElementById('pf-supplier');
  try {
    const suppliers = await Api.suppliers();
    select.innerHTML = '<option value="">— Sin proveedor —</option>'
      + suppliers.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  } catch {
    select.innerHTML = '<option value="">No se pudieron cargar proveedores</option>';
  }
}

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  productFormError.hidden = true;

  const payload = {
    name: document.getElementById('pf-name').value.trim(),
    category_id: Number(document.getElementById('pf-category').value),
    min_stock: Number(document.getElementById('pf-min-stock').value),
    max_stock: Number(document.getElementById('pf-max-stock').value),
    active: document.getElementById('pf-active').checked,
  };
  if (!editingProductId) {
    payload.price = Number(document.getElementById('pf-price').value);
    payload.stock = Number(document.getElementById('pf-stock').value);
    payload.units_per_package = Number(document.getElementById('pf-units').value);
    payload.package_cost = Number(document.getElementById('pf-package-cost').value);
    payload.initial_packages = Number(document.getElementById('pf-packages').value);
    const supplierId = document.getElementById('pf-supplier').value;
    if (supplierId) payload.initial_supplier_id = Number(supplierId);
  }

  try {
    await (editingProductId ? Api.updateProduct(editingProductId, payload) : Api.createProduct(payload));
    productModal.hidden = true;
    loadProducts();
  } catch (err) {
    productFormError.textContent = err.message;
    productFormError.hidden = false;
  }
});

// ===== Pestañas dentro de Compras/Proveedores =====
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-compras').hidden = btn.dataset.tab !== 'compras';
    document.getElementById('tab-proveedores').hidden = btn.dataset.tab !== 'proveedores';
  });
});

// ===== Compras =====
async function loadPurchases(page = 1) {
  const tbody = document.getElementById('purchases-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="muted">Cargando…</td></tr>';
  try {
    const result = await Api.purchases(page);
    const purchases = result.data || result;
    renderPager('purchases-pager', result, loadPurchases);
    if (!purchases.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">Sin compras registradas.</td></tr>';
      return;
    }
    tbody.innerHTML = purchases
      .map((p) => `
        <tr>
          <td>${new Date(p.created_at).toLocaleDateString('es-SV', { timeZone: 'America/El_Salvador' })}</td>
          <td>${p.supplier ? esc(p.supplier.name) : '—'}</td>
          <td><ul class="simple-list">${p.items.map((item) => {
            const name = item.product ? item.product.name : `Producto #${item.product_id}`;
            const packs = Number(item.package_count) || 0;
            const detail = packs
              ? `${packs} paquete(s) × ${Number(item.units_per_package) || 1} uds · ${money(item.subtotal)}`
              : `${item.quantity} unidad(es) × ${money(item.unit_cost)} · ${money(item.subtotal)}`;
            return `<li><span>${esc(name)}</span><span>${esc(detail)}</span></li>`;
          }).join('')}</ul></td>
          <td>${money(p.total)}</td>
        </tr>
      `)
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Error: ${esc(err.message)}</td></tr>`;
  }
}

// ===== Proveedores =====
async function loadSuppliers() {
  const tbody = document.getElementById('suppliers-tbody');
  tbody.innerHTML = '<tr><td colspan="3" class="muted">Cargando…</td></tr>';
  try {
    const suppliers = await Api.suppliers();
    suppliersById = Object.fromEntries(suppliers.map((s) => [s.id, s]));
    if (!suppliers.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="muted">Sin proveedores registrados.</td></tr>';
      return;
    }
    tbody.innerHTML = suppliers.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.phone || '—')}</td><td class="row-actions"><button class="btn-secondary btn-small" data-edit-supplier="${s.id}">Editar</button></td></tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" class="muted">Error: ${esc(err.message)}</td></tr>`;
  }
}

const supplierModal = document.getElementById('supplier-modal');
const supplierForm = document.getElementById('supplier-form');
const supplierFormError = document.getElementById('supplier-form-error');

document.getElementById('new-supplier-btn').addEventListener('click', () => openSupplierModal());
document.getElementById('supplier-cancel-btn').addEventListener('click', () => { supplierModal.hidden = true; });
supplierModal.addEventListener('click', (e) => { if (e.target === supplierModal) supplierModal.hidden = true; });

supplierForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  supplierFormError.hidden = true;
  const payload = {
    name: document.getElementById('sf-name').value.trim(),
    phone: document.getElementById('sf-phone').value.trim() || null,
  };
  try {
    await (editingSupplierId ? Api.updateSupplier(editingSupplierId, payload) : Api.createSupplier(payload));
    supplierModal.hidden = true;
    loadSuppliers();
    loadSuppliersIntoPurchaseForm();
  } catch (err) {
    supplierFormError.textContent = err.message;
    supplierFormError.hidden = false;
  }
});

// ===== Modal: nueva compra (líneas dinámicas de productos) =====
let productsCache = [];

async function loadProductsIntoPurchaseForm() {
  try {
    productsCache = await Api.products();
  } catch {
    productsCache = [];
  }
}

async function loadSuppliersIntoPurchaseForm() {
  const select = document.getElementById('pcf-supplier');
  try {
    const suppliers = await Api.suppliers();
    select.innerHTML = '<option value="">— Sin proveedor —</option>'
      + suppliers.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  } catch {
    select.innerHTML = '<option value="">— Sin proveedor —</option>';
  }
}

function productOptions() {
  return productsCache.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
}

function addPurchaseItemRow() {
  const container = document.getElementById('purchase-items');
  const row = document.createElement('div');
  row.className = 'purchase-item-row';
  row.innerHTML = `
    <select class="pi-product">${productOptions()}</select>
    <input type="number" class="pi-packages" placeholder="Paquetes" min="1" value="1" aria-label="Paquetes comprados">
    <input type="number" class="pi-units" placeholder="Unidades/paquete" min="1" value="1" aria-label="Unidades por paquete">
    <input type="number" class="pi-cost" placeholder="Costo paquete" step="0.01" min="0" value="0" aria-label="Costo por paquete">
    <label class="checkbox-label"><input type="checkbox" class="pi-update-price" checked> Recalcular precio (+30%)</label>
    <button type="button" class="pi-remove">✕</button>
  `;
  row.querySelector('.pi-remove').addEventListener('click', () => {
    row.remove();
    updatePurchaseTotal();
  });
  row.querySelector('.pi-packages').addEventListener('input', updatePurchaseTotal);
  row.querySelector('.pi-units').addEventListener('input', updatePurchaseTotal);
  row.querySelector('.pi-cost').addEventListener('input', updatePurchaseTotal);
  container.appendChild(row);
  updatePurchaseTotal();
}

function updatePurchaseTotal() {
  let total = 0;
  document.querySelectorAll('.purchase-item-row').forEach((row) => {
    const qty = Number(row.querySelector('.pi-packages').value) || 0;
    const cost = Number(row.querySelector('.pi-cost').value) || 0;
    total += qty * cost;
  });
  document.getElementById('purchase-total').textContent = money(total);
}

const purchaseModal = document.getElementById('purchase-modal');
const purchaseForm = document.getElementById('purchase-form');
const purchaseFormError = document.getElementById('purchase-form-error');

document.getElementById('new-purchase-btn').addEventListener('click', () => {
  document.getElementById('purchase-items').innerHTML = '';
  purchaseFormError.hidden = true;
  addPurchaseItemRow();
  purchaseModal.hidden = false;
});
document.getElementById('add-purchase-item-btn').addEventListener('click', addPurchaseItemRow);
document.getElementById('purchase-cancel-btn').addEventListener('click', () => { purchaseModal.hidden = true; });
purchaseModal.addEventListener('click', (e) => { if (e.target === purchaseModal) purchaseModal.hidden = true; });

purchaseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  purchaseFormError.hidden = true;

  const items = Array.from(document.querySelectorAll('.purchase-item-row')).map((row) => ({
    product_id: Number(row.querySelector('.pi-product').value),
    packages: Number(row.querySelector('.pi-packages').value),
    units_per_package: Number(row.querySelector('.pi-units').value),
    package_cost: Number(row.querySelector('.pi-cost').value),
    update_price: row.querySelector('.pi-update-price').checked,
  }));

  if (!items.length) {
    purchaseFormError.textContent = 'Agrega al menos un producto.';
    purchaseFormError.hidden = false;
    return;
  }

  const supplierId = document.getElementById('pcf-supplier').value;
  const payload = { items };
  if (supplierId) payload.supplier_id = Number(supplierId);

  try {
    await Api.createPurchase(payload);
    purchaseModal.hidden = true;
    loadPurchases();
  } catch (err) {
    purchaseFormError.textContent = err.message;
    purchaseFormError.hidden = false;
  }
});

// ===== Auditoría de turnos =====
async function loadShifts(page = 1) {
  const tbody = document.getElementById('shifts-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="muted">Cargando…</td></tr>';
  const onlyDiff = document.getElementById('filter-diff').checked;
  try {
    const params = { page };
    if (onlyDiff) params.with_difference = 1;
    const result = await Api.shifts(params);
    const shifts = result.data || result;
    renderPager('shifts-pager', result, loadShifts);
    if (!shifts.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">No hay turnos para mostrar.</td></tr>';
      return;
    }
    tbody.innerHTML = shifts
      .map((s) => `
        <tr class="clickable-row" data-shift-id="${s.id}">
          <td>${esc(s.user.name)}</td>
          <td>${new Date(s.opened_at).toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/El_Salvador' })}</td>
          <td>${s.closed_at ? new Date(s.closed_at).toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/El_Salvador' }) : '<span class="status-badge status-active">Abierto</span>'}</td>
          <td>${money(s.opening_amount)}</td>
          <td>${s.expected_amount !== null ? money(s.expected_amount) : '—'}</td>
          <td>${s.counted_amount !== null ? money(s.counted_amount) : '—'}</td>
          <td class="${s.difference < 0 ? 'stock-low' : s.difference > 0 ? 'diff-positive' : ''}">${s.difference !== null ? money(s.difference) : '—'}</td>
        </tr>
      `)
      .join('');

    tbody.querySelectorAll('.clickable-row').forEach((row) => {
      row.addEventListener('click', () => showShiftDetail(row.dataset.shiftId));
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Error: ${esc(err.message)}</td></tr>`;
  }
}

document.getElementById('filter-diff').addEventListener('change', () => loadShifts());

async function showShiftDetail(id) {
  const content = document.getElementById('shift-detail-content');
  const modal = document.getElementById('shift-detail-modal');
  content.innerHTML = '<p class="muted">Cargando…</p>';
  modal.hidden = false;
  try {
    const [{ shift, summary }, expenseResult] = await Promise.all([Api.shiftDetail(id), Api.expenses(1, id)]);
    const expenses = expenseResult.data || expenseResult;
    content.innerHTML = `
      <ul class="simple-list">
        <li><span>Recepcionista</span><span>${esc(shift.user.name)}</span></li>
        <li><span>Fondo inicial</span><span>${money(summary.opening_amount)}</span></li>
        <li><span>Ventas en efectivo</span><span>${money(summary.cash_sales)}</span></li>
        <li><span>Ventas con tarjeta</span><span>${money(summary.card_sales)}</span></li>
        <li><span>Ventas por transferencia</span><span>${money(summary.transfer_sales)}</span></li>
        <li><span>Gastos</span><span>${money(summary.expenses)}</span></li>
        <li><span>Esperado en caja</span><span>${money(summary.expected_amount)}</span></li>
        <li><span>Contado</span><span>${shift.counted_amount !== null ? money(shift.counted_amount) : '— (turno abierto)'}</span></li>
        <li><span>Diferencia</span><span class="${shift.difference < 0 ? 'stock-low' : ''}">${shift.difference !== null ? money(shift.difference) : '—'}</span></li>
        ${shift.notes ? `<li><span>Notas</span><span>${esc(shift.notes)}</span></li>` : ''}
      </ul>
      <h3>Detalle de gastos</h3>
      ${expenses.length ? `<ul class="simple-list">${expenses.map((expense) => `<li><span>${esc(expense.description)} · ${fmtDate(expense.created_at)}</span><strong>${money(expense.amount)}</strong></li>`).join('')}</ul>` : '<p class="muted">No hay gastos asociados a este turno.</p>'}
    `;
  } catch (err) {
    content.innerHTML = `<p class="login-error" style="margin-top:12px;">${esc(err.message)}</p>`;
  }
}

document.getElementById('shift-detail-close-btn').addEventListener('click', () => {
  document.getElementById('shift-detail-modal').hidden = true;
});
document.getElementById('shift-detail-modal').addEventListener('click', (e) => {
  if (e.target.id === 'shift-detail-modal') e.currentTarget.hidden = true;
});


// =====================================================================
// ADMINISTRACIÓN: productos, categorías, proveedores, ventas y gastos
// =====================================================================
function isAdmin() {
  const u = Api.getUser();
  return !!u && u.role === 'admin';
}
const fmtDate = (v) => new Date(v).toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/El_Salvador' });

// ----- Productos: editar y eliminar -----
let productsById = {};
let editingProductId = null;

async function openProductModal(product = null) {
  await loadSuppliersIntoProductForm();
  editingProductId = product ? product.id : null;
  productForm.reset();
  productFormError.hidden = true;
  document.getElementById('product-modal-title').textContent = product ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('pf-stock-label').textContent = product ? 'Stock' : 'Stock inicial';
  document.getElementById('pf-active-row').hidden = !product;
  packageFields.hidden = !!product;
  document.getElementById('pf-price').readOnly = true;
  document.getElementById('pf-stock').readOnly = true;
  if (product) {
    document.getElementById('pf-name').value = product.name;
    document.getElementById('pf-category').value = product.category_id;
    document.getElementById('pf-price').value = product.price;
    document.getElementById('pf-stock').value = product.stock;
    document.getElementById('pf-min-stock').value = product.min_stock;
    document.getElementById('pf-max-stock').value = product.max_stock ?? 50;
    document.getElementById('pf-active').checked = !!product.active;
  } else {
    document.getElementById('pf-packages').value = 1;
    document.getElementById('pf-units').value = 1;
    document.getElementById('pf-package-cost').value = '';
    document.getElementById('pf-supplier').value = '';
    document.getElementById('pf-max-stock').value = 50;
    updateInitialProductPrice();
  }
  productModal.hidden = false;
}

let adjustingProductId = null;
const stockAdjustModal = document.getElementById('stock-adjust-modal');
const stockAdjustForm = document.getElementById('stock-adjust-form');
document.getElementById('stock-adjust-cancel').addEventListener('click', () => { stockAdjustModal.hidden = true; });
stockAdjustModal.addEventListener('click', (e) => { if (e.target === stockAdjustModal) stockAdjustModal.hidden = true; });
function openStockAdjustment(product) {
  adjustingProductId = product.id;
  document.getElementById('stock-adjust-title').textContent = `Ajustar stock · ${product.name}`;
  document.getElementById('saf-stock').value = product.stock;
  document.getElementById('saf-reason').value = 'Corrección de inventario';
  document.getElementById('saf-note').value = '';
  document.getElementById('stock-adjust-error').hidden = true;
  stockAdjustModal.hidden = false;
}
stockAdjustForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = document.getElementById('stock-adjust-error');
  error.hidden = true;
  try {
    await Api.updateProduct(adjustingProductId, {
      stock: Number(document.getElementById('saf-stock').value),
      reason: document.getElementById('saf-reason').value,
      note: document.getElementById('saf-note').value.trim() || null,
    });
    stockAdjustModal.hidden = true;
    loadProducts(document.getElementById('product-search').value);
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  }
});

document.getElementById('products-tbody').addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-edit-product]');
  const adjustBtn = e.target.closest('[data-adjust-product]');
  const delBtn = e.target.closest('[data-delete-product]');
  const actBtn = e.target.closest('[data-activate-product]');
  const reload = () => loadProducts(document.getElementById('product-search').value);
  if (editBtn) return openProductModal(productsById[editBtn.dataset.editProduct]);
  if (adjustBtn) return openStockAdjustment(productsById[adjustBtn.dataset.adjustProduct]);
  try {
    if (actBtn) {
      await Api.updateProduct(actBtn.dataset.activateProduct, { active: true });
      reload();
    } else if (delBtn) {
      const p = productsById[delBtn.dataset.deleteProduct];
      if (!confirm(`¿Desactivar "${p.name}"? Dejará de estar disponible para la venta; su historial se conserva.`)) return;
      await Api.deleteProduct(p.id);
      reload();
    }
  } catch (err) {
    alert(`No se pudo completar la acción: ${err.message}`);
  }
});

// ----- Categorías: crear, renombrar y eliminar -----
let editingCategoryId = null;
let categoriesById = {};
const categoryModal = document.getElementById('category-modal');
const categoryForm = document.getElementById('category-form');
const categoryFormError = document.getElementById('category-form-error');

async function loadCategories() {
  const tbody = document.getElementById('categories-tbody');
  tbody.innerHTML = '<tr><td colspan="3" class="muted">Cargando…</td></tr>';
  try {
    const [categories, products] = await Promise.all([Api.categories(), Api.products('', true)]);
    categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
    const counts = {};
    products.forEach((p) => { counts[p.category_id] = (counts[p.category_id] || 0) + 1; });
    if (!categories.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="muted">Aún no hay categorías. Crea la primera con "+ Nueva categoría".</td></tr>';
      return;
    }
    tbody.innerHTML = categories.map((c) => `
      <tr>
        <td>${esc(c.name)}</td>
        <td>${counts[c.id] || 0}</td>
        <td class="row-actions">
          <button class="btn-secondary btn-small" data-edit-category="${c.id}">Editar</button>
          <button class="btn-secondary btn-small btn-danger" data-delete-category="${c.id}" ${counts[c.id] ? 'disabled title="Tiene productos asociados: muévelos a otra categoría primero"' : ''}>Eliminar</button>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" class="muted">Error: ${esc(err.message)}</td></tr>`;
  }
}

function openCategoryModal(category = null) {
  editingCategoryId = category ? category.id : null;
  categoryForm.reset();
  categoryFormError.hidden = true;
  document.getElementById('category-modal-title').textContent = category ? 'Editar categoría' : 'Nueva categoría';
  if (category) document.getElementById('cf-name').value = category.name;
  categoryModal.hidden = false;
}

document.getElementById('new-category-btn').addEventListener('click', () => openCategoryModal());
document.getElementById('category-cancel-btn').addEventListener('click', () => { categoryModal.hidden = true; });
categoryModal.addEventListener('click', (e) => { if (e.target === categoryModal) categoryModal.hidden = true; });

categoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  categoryFormError.hidden = true;
  const payload = { name: document.getElementById('cf-name').value.trim() };
  try {
    await (editingCategoryId ? Api.updateCategory(editingCategoryId, payload) : Api.createCategory(payload));
    categoryModal.hidden = true;
    loadCategories();
    loadCategoriesIntoForm();
  } catch (err) {
    categoryFormError.textContent = err.message;
    categoryFormError.hidden = false;
  }
});

document.getElementById('categories-tbody').addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-edit-category]');
  const delBtn = e.target.closest('[data-delete-category]');
  if (editBtn) return openCategoryModal(categoriesById[editBtn.dataset.editCategory]);
  if (!delBtn || delBtn.disabled) return;
  const c = categoriesById[delBtn.dataset.deleteCategory];
  if (!confirm(`¿Eliminar la categoría "${c.name}"?`)) return;
  try {
    await Api.deleteCategory(c.id);
    loadCategories();
    loadCategoriesIntoForm();
  } catch (err) {
    alert(`No se pudo eliminar la categoría: ${err.message}`);
  }
});

// ----- Proveedores: editar -----
let suppliersById = {};
let editingSupplierId = null;

function openSupplierModal(supplier = null) {
  editingSupplierId = supplier ? supplier.id : null;
  supplierForm.reset();
  supplierFormError.hidden = true;
  document.getElementById('supplier-modal-title').textContent = supplier ? 'Editar proveedor' : 'Nuevo proveedor';
  if (supplier) {
    document.getElementById('sf-name').value = supplier.name;
    document.getElementById('sf-phone').value = supplier.phone || '';
  }
  supplierModal.hidden = false;
}

document.getElementById('suppliers-tbody').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-edit-supplier]');
  if (btn) openSupplierModal(suppliersById[btn.dataset.editSupplier]);
});

// ----- Ventas: consultar y anular -----
let currentSaleId = null;
let salesPage = 1;
const saleModal = document.getElementById('sale-detail-modal');

async function loadSales(page = 1) {
  salesPage = page;
  const tbody = document.getElementById('sales-tbody');
  tbody.innerHTML = '<tr><td colspan="8" class="muted">Cargando…</td></tr>';
  try {
    const result = await Api.sales(page);
    const sales = result.data || result;
    renderPager('sales-pager', result, loadSales);
    if (!sales.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="muted">Aún no hay ventas registradas.</td></tr>';
      return;
    }
    tbody.innerHTML = sales.map((s) => `
      <tr class="clickable-row" data-sale-id="${s.id}">
        <td>#${s.id}</td>
        <td>${fmtDate(s.created_at)}</td>
        <td>${s.user ? esc(s.user.name) : '—'}</td>
        <td>${esc(conceptLabel(s.concept))}</td>
        <td>${stayRef(s)}</td>
        <td class="cap">${esc(s.payment_method)}</td>
        <td>${money(s.total)}</td>
        <td><span class="status-badge ${s.status === 'completada' ? 'status-active' : 'status-inactive'}">${esc(s.status)}</span></td>
      </tr>`).join('');
    tbody.querySelectorAll('.clickable-row').forEach((row) => {
      row.addEventListener('click', () => showSaleDetail(row.dataset.saleId));
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Error: ${esc(err.message)}</td></tr>`;
  }
}

// Concepto de la venta (campo nuevo): productos, estancia, hora extra o cargo adicional.
function conceptLabel(c) {
  const labels = {
    productos: 'Productos',
    estancia: 'Estancia',
    hora_extra: 'Hora extra',
    cargo_adicional: 'Cargo adicional',
  };
  return c ? (labels[c] || c) : 'Productos';
}

// Referencia a la estadía de una venta (stay_id es opcional).
function stayRef(sale) {
  if (!sale.stay_id) return '—';
  const room = sale.stay && sale.stay.room ? ` · Hab. ${esc(sale.stay.room.number)}` : '';
  return `#${esc(sale.stay_id)}${room}`;
}

async function showSaleDetail(id) {
  const content = document.getElementById('sale-detail-content');
  const cancelBtn = document.getElementById('sale-cancel-btn');
  currentSaleId = id;
  cancelBtn.hidden = true;
  content.innerHTML = '<p class="muted">Cargando…</p>';
  saleModal.hidden = false;
  try {
    const data = await Api.sale(id);
    const sale = data.sale || data;
    const items = sale.items || data.items || [];
    document.getElementById('sale-detail-title').textContent = `Venta #${sale.id}`;
    content.innerHTML = `
      <ul class="simple-list">
        <li><span>Fecha</span><span>${fmtDate(sale.created_at)}</span></li>
        <li><span>Cajero</span><span>${sale.user ? esc(sale.user.name) : '—'}</span></li>
        <li><span>Concepto</span><span>${esc(conceptLabel(sale.concept))}</span></li>
        ${sale.stay_id ? `<li><span>Estadía</span><span>${stayRef(sale)}</span></li>` : ''}
        <li><span>Método de pago</span><span class="cap">${esc(sale.payment_method)}</span></li>
        <li><span>Estado</span><span>${esc(sale.status)}</span></li>
        ${Number(sale.room_amount) > 0 ? `<li><span>Habitación / estancia</span><span>${money(sale.room_amount)}</span></li>` : ''}
        ${items.map((i) => `<li><span>${esc(i.quantity)} × ${i.product ? esc(i.product.name) : `Producto #${esc(i.product_id)}`}</span><span>${money(i.subtotal)}</span></li>`).join('')}
        <li><strong>Total</strong><strong>${money(sale.total)}</strong></li>
      </ul>`;
    cancelBtn.hidden = sale.status !== 'completada';
  } catch (err) {
    content.innerHTML = `<p class="login-error">${esc(err.message)}</p>`;
  }
}

document.getElementById('sale-cancel-btn').addEventListener('click', async () => {
  if (!confirm('¿Anular esta venta? Esta acción no se puede deshacer.')) return;
  try {
    await Api.cancelSale(currentSaleId);
    saleModal.hidden = true;
    loadSales(salesPage);
  } catch (err) {
    alert(`No se pudo anular la venta: ${err.message}`);
  }
});
document.getElementById('sale-detail-close-btn').addEventListener('click', () => { saleModal.hidden = true; });
saleModal.addEventListener('click', (e) => { if (e.target === saleModal) saleModal.hidden = true; });

// ----- Gastos: consultar -----
async function loadExpenses(page = 1) {
  const tbody = document.getElementById('expenses-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="muted">Cargando…</td></tr>';
  try {
    const result = await Api.expenses(page);
    const expenses = result.data || result;
    renderPager('expenses-pager', result, loadExpenses);
    if (!expenses.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted">Aún no hay gastos registrados.</td></tr>';
      return;
    }
    tbody.innerHTML = expenses.map((x) => `
      <tr>
        <td>${fmtDate(x.created_at)}</td>
        <td>${esc(x.description)}</td>
        <td>${x.user ? esc(x.user.name) : '—'}</td>
        <td>${x.shift ? (x.shift.closed_at ? 'Turno cerrado' : 'Turno abierto') : 'Sin turno de caja'}</td>
        <td>${money(x.amount)}</td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Error: ${esc(err.message)}</td></tr>`;
  }
}


// ----- Paginación común (la API devuelve 20 registros por página) -----
function renderPager(id, result, goto) {
  const el = document.getElementById(id);
  if (!result || !result.last_page || result.last_page <= 1) { el.innerHTML = ''; return; }
  const { current_page: cur, last_page: last } = result;
  el.innerHTML = `
    <button class="btn-secondary btn-small" data-page="${cur - 1}" ${cur <= 1 ? 'disabled' : ''}>Anterior</button>
    <span class="muted">Página ${cur} de ${last}</span>
    <button class="btn-secondary btn-small" data-page="${cur + 1}" ${cur >= last ? 'disabled' : ''}>Siguiente</button>`;
  el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => goto(Number(b.dataset.page))));
}

// ----- Gráfica: ventas por método de pago -----
function renderMethodsChart(byMethod) {
  const ctx = document.getElementById('chart-methods');
  const labels = Object.keys(byMethod || {});
  if (charts.methods) charts.methods.destroy();
  charts.methods = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: labels.map((k) => byMethod[k]), backgroundColor: [themeColor('--chart-primary'), themeColor('--chart-accent'), themeColor('--chart-muted')], borderColor: themeColor('--chart-surface') }],
    },
    options: { plugins: { legend: { position: 'bottom', labels: { color: themeColor('--chart-muted') } }, tooltip: { callbacks: { label: (item) => `${item.label}: ${money(item.parsed)}` } } } },
  });
}

// ----- Usuarios: crear, editar, activar y desactivar -----
let usersById = {};
let editingUserId = null;
const userModal = document.getElementById('user-modal');
const userForm = document.getElementById('user-form');
const userFormError = document.getElementById('user-form-error');

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="muted">Cargando…</td></tr>';
  try {
    const users = await Api.users();
    usersById = Object.fromEntries(users.map((u) => [u.id, u]));
    tbody.innerHTML = users.map((u) => `
      <tr>
        <td>${esc(u.name)}</td>
        <td>${esc(u.email)}</td>
        <td>${esc(({ admin: 'Administrador', recepcionista: 'Recepcionista', limpieza: 'Limpieza', mantenimiento: 'Mantenimiento' })[u.role] || u.role)}</td>
        <td><span class="status-badge ${u.active ? 'status-active' : 'status-inactive'}">${u.active ? 'Activo' : 'Inactivo'}</span></td>
        <td class="row-actions"><button class="btn-secondary btn-small" data-edit-user="${u.id}">Editar</button></td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Error: ${esc(err.message)}</td></tr>`;
  }
}

function openUserModal(user = null) {
  editingUserId = user ? user.id : null;
  userForm.reset();
  userFormError.hidden = true;
  document.getElementById('user-modal-title').textContent = user ? 'Editar usuario' : 'Nuevo usuario';
  document.getElementById('uf-password').required = !user;
  document.getElementById('uf-password-label').textContent = user
    ? 'Nueva contraseña (déjala vacía para no cambiarla)'
    : 'Contraseña (mínimo 8 caracteres)';
  document.getElementById('uf-active-row').hidden = !user;
  if (user) {
    document.getElementById('uf-name').value = user.name;
    document.getElementById('uf-email').value = user.email;
    document.getElementById('uf-role').value = user.role;
    document.getElementById('uf-active').checked = !!user.active;
  }
  userModal.hidden = false;
}

document.getElementById('new-user-btn').addEventListener('click', () => openUserModal());
document.getElementById('user-cancel-btn').addEventListener('click', () => { userModal.hidden = true; });
userModal.addEventListener('click', (e) => { if (e.target === userModal) userModal.hidden = true; });
document.getElementById('users-tbody').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-edit-user]');
  if (btn) openUserModal(usersById[btn.dataset.editUser]);
});

userForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  userFormError.hidden = true;
  const payload = {
    name: document.getElementById('uf-name').value.trim(),
    email: document.getElementById('uf-email').value.trim(),
    role: document.getElementById('uf-role').value,
  };
  const password = document.getElementById('uf-password').value;
  if (password) payload.password = password;
  if (editingUserId) payload.active = document.getElementById('uf-active').checked;
  try {
    await (editingUserId ? Api.updateUser(editingUserId, payload) : Api.createUser(payload));
    userModal.hidden = true;
    loadUsers();
  } catch (err) {
    userFormError.textContent = err.message;
    userFormError.hidden = false;
  }
});


// =====================================================================
// MÓDULO DE HABITACIONES: habitaciones, tarifas y estadías
// =====================================================================
const ROOM_STATUS = {
  disponible: { label: 'Disponible', cls: 'status-active' },
  ocupada: { label: 'Ocupada', cls: 'status-busy' },
  limpieza: { label: 'Limpieza', cls: 'status-info' },
  mantenimiento: { label: 'Mantenimiento', cls: 'status-warn' },
};
const STAY_STATUS = {
  activa: { label: 'Activa', cls: 'status-busy' },
  finalizada: { label: 'Finalizada', cls: 'status-active' },
};
const ROOM_TYPE = { estandar: 'Estándar', especial: 'Especial' };

const badge = (map, key) => {
  const s = map[key] || { label: key || '—', cls: 'status-inactive' };
  return `<span class="status-badge ${s.cls}">${esc(s.label)}</span>`;
};
const roomTypeLabel = (t) => ROOM_TYPE[t] || 'Todas';
// GET /stays y GET /rates devuelven paginado ({data: [...]}) o arreglo directo.
const listOf = (r) => (Array.isArray(r) ? r : (r && r.data) || []);

// ----- Habitaciones -----
let roomsById = {};
let editingRoomId = null;
const roomModal = document.getElementById('room-modal');
const roomForm = document.getElementById('room-form');
const roomFormError = document.getElementById('room-form-error');

function renderRoomSummary(summary) {
  const s = summary || {};
  const set = (id, v) => { document.getElementById(id).textContent = v ?? '—'; };
  set('rk-disponible', s.disponible);
  set('rk-ocupada-estandar', s.ocupada_estandar);
  set('rk-ocupada-especial', s.ocupada_especial);
  set('rk-limpieza', s.limpieza);
  set('rk-mantenimiento', s.mantenimiento);
}

// Botones de cambio de estado: la API solo permite disponible / limpieza / mantenimiento,
// y nunca sobre una habitación ocupada.
function roomStatusButtons(r) {
  if (!r.active || r.status === 'ocupada') return '';
  const btn = (status, label) => `<button class="btn-secondary btn-small" data-room-status="${r.id}:${status}">${label}</button>`;
  const role = Api.getUser()?.role;
  if (role === 'limpieza') return r.status === 'limpieza' ? btn('disponible', 'Marcar lista') : '';
  if (role === 'mantenimiento') return r.status === 'mantenimiento' ? btn('disponible', 'Marcar disponible') : '';
  if (r.status === 'limpieza') return btn('disponible', 'Marcar lista') + btn('mantenimiento', 'Mantenimiento');
  if (r.status === 'mantenimiento') return btn('disponible', 'Marcar disponible');
  return btn('mantenimiento', 'Mantenimiento'); // disponible
}

async function loadRooms() {
  const tbody = document.getElementById('rooms-tbody');
  tbody.innerHTML = '<tr><td colspan="8" class="muted">Cargando…</td></tr>';
  try {
    const params = {};
    if (document.getElementById('room-show-inactive').checked) params.only_active = 0;
    const result = await Api.rooms(params);
    const rooms = result.rooms || [];
    renderRoomSummary(result.summary);
    roomsById = Object.fromEntries(rooms.map((r) => [r.id, r]));
    // La API no filtra por estado: se filtra aquí.
    const status = document.getElementById('room-filter-status').value;
    const visible = status ? rooms.filter((r) => r.status === status) : rooms;
    if (!visible.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="muted">No hay habitaciones para mostrar.</td></tr>';
      return;
    }
    tbody.innerHTML = visible.map((r) => {
      const stay = r.current_stay;
      const occupancy = stay
        ? `${esc(stay.guest_name)}<span class="room-guest">sale ${fmtDate(stay.expected_checkout_at)}${stay.rate ? ` · ${esc(stay.rate.name)}` : ''}</span>`
        : '—';
      return `
      <tr>
        <td>${esc(r.number)}</td>
        <td>${esc(r.floor)}</td>
        <td>${esc(roomTypeLabel(r.type))}</td>
        <td>${esc(r.beds)}</td>
        <td>${badge(ROOM_STATUS, r.status)}${r.active ? '' : '<span class="status-badge status-inactive badge-gap">Fuera de servicio</span>'}</td>
        <td>${occupancy}</td>
        <td>${esc(r.notes || '—')}</td>
        <td class="row-actions">
          ${roomStatusButtons(r)}
          ${isAdmin() ? `<button class="btn-secondary btn-small" data-edit-room="${r.id}">Editar</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Error: ${esc(err.message)}</td></tr>`;
  }
}

function openRoomModal(room = null) {
  editingRoomId = room ? room.id : null;
  roomForm.reset();
  roomFormError.hidden = true;
  document.getElementById('room-modal-title').textContent = room ? 'Editar habitación' : 'Nueva habitación';
  // Al crear, la API siempre la deja disponible y en servicio.
  document.getElementById('rf-active-row').hidden = !room;
  if (room) {
    document.getElementById('rf-number').value = room.number;
    document.getElementById('rf-floor').value = room.floor;
    document.getElementById('rf-type').value = room.type;
    document.getElementById('rf-beds').value = room.beds;
    document.getElementById('rf-notes').value = room.notes || '';
    document.getElementById('rf-active').checked = !!room.active;
  }
  updateRoomBedsControl();
  roomModal.hidden = false;
}

function updateRoomBedsControl() {
  const type = document.getElementById('rf-type').value;
  const beds = document.getElementById('rf-beds');
  if (type === 'estandar') {
    beds.value = '1';
    beds.disabled = true;
  } else {
    beds.disabled = false;
    if (Number(beds.value) < 2) beds.value = '2';
  }
}
document.getElementById('rf-type').addEventListener('change', updateRoomBedsControl);

document.getElementById('new-room-btn').addEventListener('click', () => openRoomModal());
document.getElementById('room-cancel-btn').addEventListener('click', () => { roomModal.hidden = true; });
roomModal.addEventListener('click', (e) => { if (e.target === roomModal) roomModal.hidden = true; });
document.getElementById('room-filter-status').addEventListener('change', () => loadRooms());
document.getElementById('room-show-inactive').addEventListener('change', () => loadRooms());

document.getElementById('rooms-tbody').addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-edit-room]');
  const statusBtn = e.target.closest('[data-room-status]');
  if (editBtn) return openRoomModal(roomsById[editBtn.dataset.editRoom]);
  if (!statusBtn) return;
  const [id, status] = statusBtn.dataset.roomStatus.split(':');
  try {
    await Api.updateRoomStatus(id, status);
    loadRooms();
  } catch (err) {
    alert(`No se pudo cambiar el estado: ${err.message}`);
  }
});

roomForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  roomFormError.hidden = true;
  const payload = {
    number: document.getElementById('rf-number').value.trim(),
    floor: Number(document.getElementById('rf-floor').value),
    type: document.getElementById('rf-type').value,
    beds: Number(document.getElementById('rf-beds').value),
    notes: document.getElementById('rf-notes').value.trim() || null,
  };
  if (editingRoomId) payload.active = document.getElementById('rf-active').checked;
  try {
    await (editingRoomId ? Api.updateRoom(editingRoomId, payload) : Api.createRoom(payload));
    roomModal.hidden = true;
    loadRooms();
  } catch (err) {
    roomFormError.textContent = err.message;
    roomFormError.hidden = false;
  }
});

// ----- Tarifas -----
let ratesById = {};
let editingRateId = null;
const rateModal = document.getElementById('rate-modal');
const rateForm = document.getElementById('rate-form');
const rateFormError = document.getElementById('rate-form-error');
const rateBedsSelect = document.getElementById('tf-beds');

function rateDefinitionIsValid(rate) {
  const beds = Number(rate.beds);
  return (rate.room_type === 'estandar' && beds === 1)
    || (rate.room_type === 'especial' && Number.isInteger(beds) && beds >= 2 && beds <= 4);
}

function updateRateFormControls(clearActive = false) {
  const type = document.getElementById('tf-room-type').value;
  if (type === 'estandar') {
    rateBedsSelect.value = '1';
    rateBedsSelect.disabled = true;
  } else if (type === 'especial') {
    rateBedsSelect.disabled = false;
    if (rateForm.dataset.resetBeds === 'true') rateBedsSelect.value = '';
    if (rateBedsSelect.value === '1') rateBedsSelect.value = '2';
  } else {
    rateBedsSelect.value = '';
    rateBedsSelect.disabled = true;
  }
  rateForm.dataset.resetBeds = 'false';
  const definitionValid = rateDefinitionIsValid({ room_type: type, beds: rateBedsSelect.value });
  const active = document.getElementById('tf-active');
  if (clearActive || !definitionValid) active.checked = false;
  active.disabled = !definitionValid;
}

async function loadRates() {
  const tbody = document.getElementById('rates-tbody');
  tbody.innerHTML = '<tr><td colspan="8" class="muted">Cargando…</td></tr>';
  try {
    const rates = listOf(await Api.rates({ only_active: 0 }));
    ratesById = Object.fromEntries(rates.map((t) => [t.id, t]));
    const legacyCount = rates.filter((rate) => !rateDefinitionIsValid(rate)).length;
    const legacyAlert = document.getElementById('rates-legacy-alert');
    legacyAlert.hidden = !legacyCount;
    legacyAlert.textContent = legacyCount
      ? `${legacyCount} tarifa${legacyCount === 1 ? '' : 's'} necesita${legacyCount === 1 ? '' : 'n'} tipo y camas exactos. Usa “Corregir” para completar los datos; las tarifas incompletas no se ofrecerán en reservas ni estadías.`
      : '';
    if (!rates.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="muted">Aún no hay tarifas. Crea la primera con "+ Nueva tarifa".</td></tr>';
      return;
    }
    tbody.innerHTML = rates.map((t) => `
      <tr>
        <td>${esc(t.name)}</td>
        <td>${esc(ROOM_TYPE[t.room_type] || 'Sin asignar')}</td>
        <td>${Number.isInteger(Number(t.beds)) && Number(t.beds) > 0 ? `${esc(t.beds)} ${Number(t.beds) === 1 ? 'cama' : 'camas'}` : '<span class="status-badge status-warn">Sin asignar</span>'}</td>
        <td>${esc(t.hours)} h</td>
        <td>${money(t.price)}</td>
        <td>${Number(t.extra_hour_price) > 0 ? money(t.extra_hour_price) : '—'}</td>
        <td><span class="status-badge ${rateDefinitionIsValid(t) ? (t.active ? 'status-active' : 'status-inactive') : 'status-warn'}">${rateDefinitionIsValid(t) ? (t.active ? 'Activa' : 'Inactiva') : `${t.active ? 'Activa · ' : 'Inactiva · '}corregir datos`}</span></td>
        <td class="row-actions">${isAdmin() ? `<button class="btn-secondary btn-small" data-edit-rate="${t.id}">${rateDefinitionIsValid(t) ? 'Editar' : 'Corregir'}</button>` : ''}</td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Error: ${esc(err.message)}</td></tr>`;
  }
}

function openRateModal(rate = null) {
  editingRateId = rate ? rate.id : null;
  rateForm.reset();
  rateFormError.hidden = true;
  document.getElementById('rate-modal-title').textContent = rate ? (rateDefinitionIsValid(rate) ? 'Editar tarifa' : 'Corregir tarifa') : 'Nueva tarifa';
  if (rate) {
    document.getElementById('tf-name').value = rate.name;
    document.getElementById('tf-hours').value = rate.hours;
    document.getElementById('tf-room-type').value = ['estandar', 'especial'].includes(rate.room_type) ? rate.room_type : '';
    rateBedsSelect.value = Number(rate.beds) >= 1 && Number(rate.beds) <= 4 ? String(rate.beds) : '';
    document.getElementById('tf-price').value = rate.price;
    document.getElementById('tf-extra').value = rate.extra_hour_price ?? 0;
    document.getElementById('tf-active').checked = rateDefinitionIsValid(rate) && !!rate.active;
  }
  rateForm.dataset.resetBeds = 'false';
  updateRateFormControls();
  rateModal.hidden = false;
}

document.getElementById('tf-room-type').addEventListener('change', () => {
  rateForm.dataset.resetBeds = 'true';
  updateRateFormControls(true);
});
rateBedsSelect.addEventListener('change', () => updateRateFormControls(true));

document.getElementById('new-rate-btn').addEventListener('click', () => openRateModal());
document.getElementById('rate-cancel-btn').addEventListener('click', () => { rateModal.hidden = true; });
rateModal.addEventListener('click', (e) => { if (e.target === rateModal) rateModal.hidden = true; });
document.getElementById('rates-tbody').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-edit-rate]');
  if (btn) openRateModal(ratesById[btn.dataset.editRate]);
});

rateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  rateFormError.hidden = true;
  const roomType = document.getElementById('tf-room-type').value;
  const beds = Number(rateBedsSelect.value);
  if (!rateDefinitionIsValid({ room_type: roomType, beds })) {
    rateFormError.textContent = roomType === 'estandar'
      ? 'Una tarifa estándar debe tener exactamente 1 cama.'
      : 'Selecciona el tipo de habitación y una cantidad de camas válida (2 a 4 para especial).';
    rateFormError.hidden = false;
    return;
  }
  const payload = {
    name: document.getElementById('tf-name').value.trim(),
    hours: Number(document.getElementById('tf-hours').value),
    room_type: roomType,
    beds,
    price: Number(document.getElementById('tf-price').value),
    extra_hour_price: Number(document.getElementById('tf-extra').value),
    active: document.getElementById('tf-active').checked,
  };
  try {
    await (editingRateId ? Api.updateRate(editingRateId, payload) : Api.createRate(payload));
    rateModal.hidden = true;
    loadRates();
  } catch (err) {
    rateFormError.textContent = err.message;
    rateFormError.hidden = false;
  }
});

// ----- Estadías (consulta y check-out; el check-in y los cobros se hacen desde el POS) -----
let staysPage = 1;
let currentStayId = null;
const stayDetailModal = document.getElementById('stay-detail-modal');

async function loadStays(page = 1) {
  staysPage = page;
  const tbody = document.getElementById('stays-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="muted">Cargando…</td></tr>';
  try {
    const params = { page };
    const status = document.getElementById('stay-filter-status').value;
    if (status) params.status = status; // filtro del lado del servidor (solo admin)
    const result = await Api.stays(params);
    const stays = listOf(result);
    renderPager('stays-pager', result, loadStays);
    if (!stays.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted">No hay estadías para mostrar.</td></tr>';
      return;
    }
    tbody.innerHTML = stays.map((s) => `
      <tr class="clickable-row" data-stay-id="${s.id}">
        <td>${s.room ? esc(s.room.number) : `#${esc(s.room_id)}`}</td>
        <td>${esc(s.guest_name)}</td>
        <td>${s.rate ? esc(s.rate.name) : '—'}</td>
        <td>${fmtDate(s.check_in_at)}</td>
        <td>${s.checked_out_at ? fmtDate(s.checked_out_at) : `<span class="muted">prevista ${fmtDate(s.expected_checkout_at)}</span>`}</td>
        <td>${badge(STAY_STATUS, s.status)}</td>
      </tr>`).join('');
    tbody.querySelectorAll('.clickable-row').forEach((row) => {
      row.addEventListener('click', () => showStayDetail(row.dataset.stayId));
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Error: ${esc(err.message)}</td></tr>`;
  }
}

document.getElementById('stay-filter-status').addEventListener('change', () => loadStays());

async function showStayDetail(id) {
  const content = document.getElementById('stay-detail-content');
  const checkoutBtn = document.getElementById('stay-checkout-btn');
  const extendBtn = document.getElementById('stay-extend-btn');
  const chargeBtn = document.getElementById('stay-charge-btn');
  currentStayId = id;
  checkoutBtn.hidden = extendBtn.hidden = chargeBtn.hidden = true;
  content.innerHTML = '<p class="muted">Cargando…</p>';
  stayDetailModal.hidden = false;
  try {
    const { stay, total_paid: totalPaid } = await Api.stay(id);
    const sales = stay.sales || [];
    const charges = stay.charges || [];
    const pendingCharges = charges.filter((charge) => !charge.paid_at);
    const pendingTotal = pendingCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0);
    document.getElementById('stay-detail-title').textContent = `Estadía #${stay.id}`;
    content.innerHTML = `
      <ul class="simple-list">
        <li><span>Habitación</span><span>${stay.room ? esc(stay.room.number) : `#${esc(stay.room_id)}`}</span></li>
        <li><span>Huésped</span><span>${esc(stay.guest_name)}</span></li>
        ${stay.guest_document ? `<li><span>Documento</span><span>${esc(stay.guest_document)}</span></li>` : ''}
        <li><span>Huéspedes</span><span>${esc(stay.guests ?? 1)}</span></li>
        <li><span>Tarifa</span><span>${stay.rate ? esc(stay.rate.name) : '—'}</span></li>
        <li><span>Registrada por</span><span>${stay.user ? esc(stay.user.name) : '—'}</span></li>
        <li><span>Ingreso</span><span>${fmtDate(stay.check_in_at)}</span></li>
        <li><span>Salida prevista</span><span>${fmtDate(stay.expected_checkout_at)}</span></li>
        <li><span>Salida real</span><span>${stay.checked_out_at ? fmtDate(stay.checked_out_at) : '—'}</span></li>
        <li><span>Horas extra</span><span>${esc(stay.extra_hours ?? 0)}</span></li>
        <li><span>Estado</span><span>${badge(STAY_STATUS, stay.status)}</span></li>
        ${stay.notes ? `<li><span>Notas</span><span style="white-space:pre-line;text-align:right">${esc(stay.notes)}</span></li>` : ''}
        ${sales.map((v) => `<li><span>Venta #${esc(v.id)} · ${esc(conceptLabel(v.concept))}${v.status === 'anulada' ? ' (anulada)' : ''}</span><span>${money(v.total)}</span></li>`).join('')}
        ${charges.map((charge) => `<li><span>${esc(charge.description || `Cargo #${charge.id}`)} · ${charge.paid_at ? 'Pagado' : 'Pendiente'}</span><span>${money(charge.amount)}</span></li>`).join('')}
        <li><strong>Cargos pendientes</strong><strong>${money(pendingTotal)}</strong></li>
        <li><strong>Total cobrado</strong><strong>${money(totalPaid)}</strong></li>
      </ul>`;
    checkoutBtn.hidden = extendBtn.hidden = chargeBtn.hidden = stay.status !== 'activa';
  } catch (err) {
    content.innerHTML = `<p class="login-error">${esc(err.message)}</p>`;
  }
}

document.getElementById('stay-checkout-btn').addEventListener('click', async () => {
  document.getElementById('stay-checkout-error').hidden = true;
  stayDetailModal.hidden = true;
  document.getElementById('stay-checkout-modal').hidden = false;
});
document.getElementById('stay-detail-close-btn').addEventListener('click', () => { stayDetailModal.hidden = true; });
stayDetailModal.addEventListener('click', (e) => { if (e.target === stayDetailModal) stayDetailModal.hidden = true; });
