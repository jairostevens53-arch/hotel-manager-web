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
  loadDashboard();
  loadCategoriesIntoForm();
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
