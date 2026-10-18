// ===== Elementos principales =====
const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginSubmit = document.getElementById('login-submit');

let charts = { salesDay: null, topProducts: null, methods: null };
let currentDays = 7;

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
  document.getElementById('user-role').textContent = user.role === 'admin' ? 'Administrador' : 'Recepcionista';

  const isAdmin = user.role === 'admin';
  ['dashboard', 'compras', 'turnos', 'categorias', 'ventas', 'gastos', 'usuarios'].forEach((v) => {
    document.querySelector(`[data-view="${v}"]`).hidden = !isAdmin;
  });
  document.getElementById('new-product-btn').hidden = !isAdmin;

  if (isAdmin) {
    showView('dashboard');
    loadDashboard();
    loadCategoriesIntoForm();
  } else {
    // Los recepcionistas no tienen acceso al dashboard (la API lo restringe a admin): van directo al catálogo.
    showView('catalogo');
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
  document.querySelectorAll('.view').forEach((v) => (v.hidden = true));
  document.getElementById(`view-${viewName}`).hidden = false;
  document.getElementById('view-title').textContent = btn.textContent.trim();

  if (viewName === 'catalogo') loadProducts();
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
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('disabled')) return;
    showView(btn.dataset.view);
  });
});

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
    renderKpis(data.totals);
    renderLowStock(data.low_stock);
    renderOpenShifts(data.open_shifts);
    if (typeof Chart === 'undefined') {
      console.error('Chart.js no se cargó: revisa que exista js/chart.umd.min.js');
      return;
    }
    renderSalesByDayChart(data.sales_by_day);
    renderTopProductsChart(data.top_products);
    renderMethodsChart(data.sales_by_method);
  } catch (err) {
    document.getElementById('kpi-sales').textContent = '—';
    console.error('Error cargando el dashboard:', err.message);
  }
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

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
        borderColor: '#f2994a',
        backgroundColor: 'rgba(242, 153, 74, 0.12)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#f2994a',
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8d96ab' }, grid: { color: '#223156' } },
        y: { ticks: { color: '#8d96ab' }, grid: { color: '#223156' }, beginAtZero: true },
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
      datasets: [{ label: 'Unidades vendidas', data: quantities, backgroundColor: '#2dd4bf' }],
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8d96ab' }, grid: { color: '#223156' }, beginAtZero: true },
        y: { ticks: { color: '#8d96ab' }, grid: { display: false } },
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
    .map((s) => `<li><span>${esc(s.user.name)}</span><span class="muted">desde ${new Date(s.opened_at).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}</span></li>`)
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
          <td class="${p.stock <= p.min_stock ? 'stock-low' : ''}">${p.stock}</td>
          <td><span class="status-badge ${p.active ? 'status-active' : 'status-inactive'}">${p.active ? 'Activo' : 'Inactivo'}</span></td>
          ${isAdmin() ? `<td class="row-actions">
            <button class="btn-secondary btn-small" data-edit-product="${p.id}">Editar</button>
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

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  productFormError.hidden = true;

  const payload = {
    name: document.getElementById('pf-name').value.trim(),
    category_id: Number(document.getElementById('pf-category').value),
    price: Number(document.getElementById('pf-price').value),
    stock: Number(document.getElementById('pf-stock').value),
    min_stock: Number(document.getElementById('pf-min-stock').value),
    active: document.getElementById('pf-active').checked,
  };

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
          <td>${new Date(p.created_at).toLocaleDateString('es-SV')}</td>
          <td>${p.supplier ? esc(p.supplier.name) : '—'}</td>
          <td>${p.items.length} producto(s)</td>
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
    <input type="number" class="pi-qty" placeholder="Cant." min="1" value="1">
    <input type="number" class="pi-cost" placeholder="Costo u." step="0.01" min="0" value="0">
    <button type="button" class="pi-remove">✕</button>
  `;
  row.querySelector('.pi-remove').addEventListener('click', () => {
    row.remove();
    updatePurchaseTotal();
  });
  row.querySelector('.pi-qty').addEventListener('input', updatePurchaseTotal);
  row.querySelector('.pi-cost').addEventListener('input', updatePurchaseTotal);
  container.appendChild(row);
  updatePurchaseTotal();
}

function updatePurchaseTotal() {
  let total = 0;
  document.querySelectorAll('.purchase-item-row').forEach((row) => {
    const qty = Number(row.querySelector('.pi-qty').value) || 0;
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
    quantity: Number(row.querySelector('.pi-qty').value),
    unit_cost: Number(row.querySelector('.pi-cost').value),
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
          <td>${new Date(s.opened_at).toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short' })}</td>
          <td>${s.closed_at ? new Date(s.closed_at).toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short' }) : '<span class="status-badge status-active">Abierto</span>'}</td>
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
    const { shift, summary } = await Api.shiftDetail(id);
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
const fmtDate = (v) => new Date(v).toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short' });

// ----- Productos: editar y eliminar -----
let productsById = {};
let editingProductId = null;

function openProductModal(product = null) {
  editingProductId = product ? product.id : null;
  productForm.reset();
  productFormError.hidden = true;
  document.getElementById('product-modal-title').textContent = product ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('pf-stock-label').textContent = product ? 'Stock' : 'Stock inicial';
  document.getElementById('pf-active-row').hidden = !product;
  if (product) {
    document.getElementById('pf-name').value = product.name;
    document.getElementById('pf-category').value = product.category_id;
    document.getElementById('pf-price').value = product.price;
    document.getElementById('pf-stock').value = product.stock;
    document.getElementById('pf-min-stock').value = product.min_stock;
    document.getElementById('pf-active').checked = !!product.active;
  }
  productModal.hidden = false;
}

document.getElementById('products-tbody').addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-edit-product]');
  const delBtn = e.target.closest('[data-delete-product]');
  const actBtn = e.target.closest('[data-activate-product]');
  const reload = () => loadProducts(document.getElementById('product-search').value);
  if (editBtn) return openProductModal(productsById[editBtn.dataset.editProduct]);
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
  tbody.innerHTML = '<tr><td colspan="6" class="muted">Cargando…</td></tr>';
  try {
    const result = await Api.sales(page);
    const sales = result.data || result;
    renderPager('sales-pager', result, loadSales);
    if (!sales.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted">Aún no hay ventas registradas.</td></tr>';
      return;
    }
    tbody.innerHTML = sales.map((s) => `
      <tr class="clickable-row" data-sale-id="${s.id}">
        <td>#${s.id}</td>
        <td>${fmtDate(s.created_at)}</td>
        <td>${s.user ? esc(s.user.name) : '—'}</td>
        <td class="cap">${esc(s.payment_method)}</td>
        <td>${money(s.total)}</td>
        <td><span class="status-badge ${s.status === 'completada' ? 'status-active' : 'status-inactive'}">${esc(s.status)}</span></td>
      </tr>`).join('');
    tbody.querySelectorAll('.clickable-row').forEach((row) => {
      row.addEventListener('click', () => showSaleDetail(row.dataset.saleId));
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Error: ${esc(err.message)}</td></tr>`;
  }
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
        <li><span>Método de pago</span><span class="cap">${esc(sale.payment_method)}</span></li>
        <li><span>Estado</span><span>${esc(sale.status)}</span></li>
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
  tbody.innerHTML = '<tr><td colspan="4" class="muted">Cargando…</td></tr>';
  try {
    const result = await Api.expenses(page);
    const expenses = result.data || result;
    renderPager('expenses-pager', result, loadExpenses);
    if (!expenses.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">Aún no hay gastos registrados.</td></tr>';
      return;
    }
    tbody.innerHTML = expenses.map((x) => `
      <tr>
        <td>${fmtDate(x.created_at)}</td>
        <td>${esc(x.description)}</td>
        <td>${x.user ? esc(x.user.name) : '—'}</td>
        <td>${money(x.amount)}</td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Error: ${esc(err.message)}</td></tr>`;
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
      datasets: [{ data: labels.map((k) => byMethod[k]), backgroundColor: ['#f2994a', '#2dd4bf', '#8d96ab'], borderColor: '#0f1c38' }],
    },
    options: { plugins: { legend: { position: 'bottom', labels: { color: '#8d96ab' } } } },
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
        <td>${u.role === 'admin' ? 'Administrador' : 'Recepcionista'}</td>
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
