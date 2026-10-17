// ===== Elementos principales =====
const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginSubmit = document.getElementById('login-submit');

let charts = { salesDay: null, topProducts: null };
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
  document.getElementById('user-role').textContent = user.role;

  const isAdmin = user.role === 'admin';
  document.querySelector('[data-view="compras"]').hidden = !isAdmin;
  document.querySelector('[data-view="turnos"]').hidden = !isAdmin;
  document.getElementById('new-product-btn').hidden = !isAdmin;

  if (isAdmin) {
    loadDashboard();
    loadCategoriesIntoForm();
  } else {
    // Los recepcionistas no tienen acceso al dashboard; se les manda directo al catálogo.
    document.querySelector('[data-view="catalogo"]').click();
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
document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('disabled')) return;
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const viewName = btn.dataset.view;
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
    renderSalesByDayChart(data.sales_by_day);
    renderTopProductsChart(data.top_products);
    renderLowStock(data.low_stock);
    renderOpenShifts(data.open_shifts);
  } catch (err) {
    document.getElementById('kpi-sales').textContent = '—';
    console.error('Error cargando el dashboard:', err.message);
  }
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
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
    .map((p) => `<li><span>${p.name}</span><span class="stock-low">${p.stock} / mín. ${p.min_stock}</span></li>`)
    .join('');
}

function renderOpenShifts(shifts) {
  const list = document.getElementById('open-shifts-list');
  if (!shifts.length) {
    list.innerHTML = '<li class="muted">No hay turnos abiertos.</li>';
    return;
  }
  list.innerHTML = shifts
    .map((s) => `<li><span>${s.user.name}</span><span class="muted">desde ${new Date(s.opened_at).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}</span></li>`)
    .join('');
}

// ===== Catálogo =====
async function loadProducts(query = '') {
  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="muted">Cargando…</td></tr>';
  try {
    const products = await Api.products(query);
    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted">No se encontraron productos.</td></tr>';
      return;
    }
    tbody.innerHTML = products
      .map((p) => `
        <tr>
          <td>${p.name}</td>
          <td>${p.category ? p.category.name : '—'}</td>
          <td>${money(p.price)}</td>
          <td class="${p.stock <= p.min_stock ? 'stock-low' : ''}">${p.stock}</td>
          <td><span class="status-badge ${p.active ? 'status-active' : 'status-inactive'}">${p.active ? 'Activo' : 'Inactivo'}</span></td>
        </tr>
      `)
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Error al cargar: ${err.message}</td></tr>`;
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

document.getElementById('new-product-btn').addEventListener('click', () => {
  productForm.reset();
  productFormError.hidden = true;
  productModal.hidden = false;
});

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
    select.innerHTML = categories.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
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
  };

  try {
    await Api.createProduct(payload);
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
async function loadPurchases() {
  const tbody = document.getElementById('purchases-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="muted">Cargando…</td></tr>';
  try {
    const result = await Api.purchases();
    const purchases = result.data || result;
    if (!purchases.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">Sin compras registradas.</td></tr>';
      return;
    }
    tbody.innerHTML = purchases
      .map((p) => `
        <tr>
          <td>${new Date(p.created_at).toLocaleDateString('es-SV')}</td>
          <td>${p.supplier ? p.supplier.name : '—'}</td>
          <td>${p.items.length} producto(s)</td>
          <td>${money(p.total)}</td>
        </tr>
      `)
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Error: ${err.message}</td></tr>`;
  }
}

// ===== Proveedores =====
async function loadSuppliers() {
  const tbody = document.getElementById('suppliers-tbody');
  tbody.innerHTML = '<tr><td colspan="2" class="muted">Cargando…</td></tr>';
  try {
    const suppliers = await Api.suppliers();
    if (!suppliers.length) {
      tbody.innerHTML = '<tr><td colspan="2" class="muted">Sin proveedores registrados.</td></tr>';
      return;
    }
    tbody.innerHTML = suppliers.map((s) => `<tr><td>${s.name}</td><td>${s.phone || '—'}</td></tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="2" class="muted">Error: ${err.message}</td></tr>`;
  }
}

const supplierModal = document.getElementById('supplier-modal');
const supplierForm = document.getElementById('supplier-form');
const supplierFormError = document.getElementById('supplier-form-error');

document.getElementById('new-supplier-btn').addEventListener('click', () => {
  supplierForm.reset();
  supplierFormError.hidden = true;
  supplierModal.hidden = false;
});
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
    await Api.createSupplier(payload);
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
      + suppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
  } catch {
    select.innerHTML = '<option value="">— Sin proveedor —</option>';
  }
}

function productOptions() {
  return productsCache.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
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
async function loadShifts() {
  const tbody = document.getElementById('shifts-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="muted">Cargando…</td></tr>';
  const onlyDiff = document.getElementById('filter-diff').checked;
  try {
    const params = {};
    if (onlyDiff) params.with_difference = 1;
    const result = await Api.shifts(params);
    const shifts = result.data || result;
    if (!shifts.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">No hay turnos para mostrar.</td></tr>';
      return;
    }
    tbody.innerHTML = shifts
      .map((s) => `
        <tr class="clickable-row" data-shift-id="${s.id}">
          <td>${s.user.name}</td>
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
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Error: ${err.message}</td></tr>`;
  }
}

document.getElementById('filter-diff').addEventListener('change', loadShifts);

async function showShiftDetail(id) {
  const content = document.getElementById('shift-detail-content');
  const modal = document.getElementById('shift-detail-modal');
  content.innerHTML = '<p class="muted">Cargando…</p>';
  modal.hidden = false;
  try {
    const { shift, summary } = await Api.shiftDetail(id);
    content.innerHTML = `
      <ul class="simple-list">
        <li><span>Recepcionista</span><span>${shift.user.name}</span></li>
        <li><span>Fondo inicial</span><span>${money(summary.opening_amount)}</span></li>
        <li><span>Ventas en efectivo</span><span>${money(summary.cash_sales)}</span></li>
        <li><span>Ventas con tarjeta</span><span>${money(summary.card_sales)}</span></li>
        <li><span>Ventas por transferencia</span><span>${money(summary.transfer_sales)}</span></li>
        <li><span>Gastos</span><span>${money(summary.expenses)}</span></li>
        <li><span>Esperado en caja</span><span>${money(summary.expected_amount)}</span></li>
        <li><span>Contado</span><span>${shift.counted_amount !== null ? money(shift.counted_amount) : '— (turno abierto)'}</span></li>
        <li><span>Diferencia</span><span class="${shift.difference < 0 ? 'stock-low' : ''}">${shift.difference !== null ? money(shift.difference) : '—'}</span></li>
        ${shift.notes ? `<li><span>Notas</span><span>${shift.notes}</span></li>` : ''}
      </ul>
    `;
  } catch (err) {
    content.innerHTML = `<p class="login-error" style="margin-top:12px;">${err.message}</p>`;
  }
}

document.getElementById('shift-detail-close-btn').addEventListener('click', () => {
  document.getElementById('shift-detail-modal').hidden = true;
});
document.getElementById('shift-detail-modal').addEventListener('click', (e) => {
  if (e.target.id === 'shift-detail-modal') e.currentTarget.hidden = true;
});
