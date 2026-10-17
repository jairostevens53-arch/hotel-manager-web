/**
 * Cliente de la API de Hotel Manager Cloud POS.
 * Cambia API_BASE si en el futuro la URL de Render cambia, o si
 * quieren apuntar a un entorno local (http://hotel-manager-api.test/api).
 */
const API_BASE = 'https://hotel-manager-api-ttg7.onrender.com/api';

const Api = {
  getToken() {
    return localStorage.getItem('lopes_token');
  },

  setToken(token) {
    localStorage.setItem('lopes_token', token);
  },

  clearToken() {
    localStorage.removeItem('lopes_token');
  },

  getUser() {
    const raw = localStorage.getItem('lopes_user');
    return raw ? JSON.parse(raw) : null;
  },

  setUser(user) {
    localStorage.setItem('lopes_user', JSON.stringify(user));
  },

  /**
   * Hace una petición a la API, agregando el token automáticamente.
   * Lanza un Error con el mensaje del servidor si la respuesta no es exitosa.
   */
  async request(path, { method = 'GET', body = null } = {}) {
    const headers = { Accept: 'application/json' };
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new Error('No se pudo conectar con el servidor. Si es la primera petición del día, puede estar reactivándose; espera unos segundos e intenta de nuevo.');
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      // Respuesta sin cuerpo JSON (poco común, pero no debe romper la app).
    }

    // Sesión vencida o token inválido: volver al login (excepto en el propio login).
    if (response.status === 401 && path !== '/login') {
      this.clearToken();
      localStorage.removeItem('lopes_user');
      location.reload();
    }

    if (!response.ok) {
      const message = (data && (data.message || Object.values(data.errors || {}).flat()[0])) || `Error ${response.status}`;
      throw new Error(message);
    }

    return data;
  },

  login(email, password) {
    return this.request('/login', { method: 'POST', body: { email, password } });
  },

  logout() {
    return this.request('/logout', { method: 'POST' });
  },

  me() {
    return this.request('/me');
  },

  dashboard(days = 7) {
    return this.request(`/reports/dashboard?days=${days}`);
  },

  categories() {
    return this.request('/categories');
  },

  products(query = '', includeInactive = false) {
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    if (includeInactive) qs.set('only_active', '0');
    const s = qs.toString();
    return this.request(`/products${s ? `?${s}` : ''}`);
  },

  createProduct(payload) {
    return this.request('/products', { method: 'POST', body: payload });
  },

  suppliers() {
    return this.request('/suppliers');
  },

  createSupplier(payload) {
    return this.request('/suppliers', { method: 'POST', body: payload });
  },

  purchases(page = 1) {
    return this.request(`/purchases?page=${page}`);
  },

  createPurchase(payload) {
    return this.request('/purchases', { method: 'POST', body: payload });
  },

  shifts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/shifts${qs ? `?${qs}` : ''}`);
  },

  shiftDetail(id) {
    return this.request(`/shifts/${id}`);
  },

  createCategory(payload) { return this.request('/categories', { method: 'POST', body: payload }); },
  updateCategory(id, payload) { return this.request(`/categories/${id}`, { method: 'PUT', body: payload }); },
  deleteCategory(id) { return this.request(`/categories/${id}`, { method: 'DELETE' }); },

  updateProduct(id, payload) { return this.request(`/products/${id}`, { method: 'PUT', body: payload }); },
  deleteProduct(id) { return this.request(`/products/${id}`, { method: 'DELETE' }); },

  updateSupplier(id, payload) { return this.request(`/suppliers/${id}`, { method: 'PUT', body: payload }); },

  sales(page = 1) { return this.request(`/sales?page=${page}`); },
  sale(id) { return this.request(`/sales/${id}`); },
  cancelSale(id) { return this.request(`/sales/${id}/cancel`, { method: 'POST' }); },

  expenses(page = 1) { return this.request(`/expenses?page=${page}`); },

  users() { return this.request('/users'); },
  createUser(payload) { return this.request('/users', { method: 'POST', body: payload }); },
  updateUser(id, payload) { return this.request(`/users/${id}`, { method: 'PUT', body: payload }); },
};
