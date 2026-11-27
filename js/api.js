/**
 * Cliente de la API de Hotel Manager Cloud POS.
 * Cambia API_BASE si en el futuro la URL de Render cambia, o si
 * quieren apuntar a un entorno local (http://hotel-manager-api.test/api).
 */
// Configurable at runtime by setting window.HOTEL_API_BASE before loading this file.
const API_BASE = (window.HOTEL_API_BASE || 'https://hotel-manager-api-ttg7.onrender.com/api').replace(/\/$/, '');

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
      const validation = data?.errors ? Object.values(data.errors).flat().join(' ') : '';
      const fallback = ({ 403: 'No tienes permiso para realizar esta operación.', 422: 'Revisa los datos ingresados.', 429: 'Demasiados intentos. Espera un momento y vuelve a intentarlo.', 500: 'El servidor tuvo un problema. Intenta de nuevo más tarde.' })[response.status];
      const message = response.status === 422 && validation
        ? validation
        : (data?.message || validation || fallback || `Error ${response.status}`);
      const error = new Error(message);
      error.status = response.status;
      error.errors = data?.errors || {};
      throw error;
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

  expenses(page = 1, shiftId = null) { return this.request(`/expenses?page=${page}${shiftId ? `&shift_id=${encodeURIComponent(shiftId)}` : ''}`); },
  createExpense(payload) { return this.request('/expenses', { method: 'POST', body: payload }); },
  currentShift() { return this.request('/shifts/current'); },
  async ensureCurrentShift() {
    try { return await this.currentShift(); }
    catch (error) {
      if (error.status !== 404) throw error;
      try { return await this.openShift({ opening_amount: 0 }); }
      catch (openError) {
        if (openError.status === 409) return this.currentShift();
        throw openError;
      }
    }
  },
  openShift(payload) { return this.request('/shifts/open', { method: 'POST', body: payload }); },
  closeShift(payload) { return this.request('/shifts/close', { method: 'POST', body: payload }); },
  createSale(payload) { return this.request('/sales', { method: 'POST', body: payload }); },
  guests(params = {}) { const qs = new URLSearchParams(params).toString(); return this.request(`/guests${qs ? `?${qs}` : ''}`); },
  guest(id) { return this.request(`/guests/${id}`); },
  createGuest(payload) { return this.request('/guests', { method: 'POST', body: payload }); },
  updateGuest(id, payload) { return this.request(`/guests/${id}`, { method: 'PUT', body: payload }); },
  reservations(params = {}) { const qs = new URLSearchParams(params).toString(); return this.request(`/reservations${qs ? `?${qs}` : ''}`); },
  createReservation(payload) { return this.request('/reservations', { method: 'POST', body: payload }); },
  cancelReservation(id) { return this.request(`/reservations/${id}/cancel`, { method: 'POST' }); },
  checkInReservation(id, payload) { return this.request(`/reservations/${id}/check-in`, { method: 'POST', body: payload }); },
  tasks(params = {}) { const qs = new URLSearchParams(params).toString(); return this.request(`/tasks${qs ? `?${qs}` : ''}`); },
  createTask(payload) { return this.request('/tasks', { method: 'POST', body: payload }); },
  assignTask(id, assigned_to) { return this.request(`/tasks/${id}/assign`, { method: 'PATCH', body: { assigned_to } }); },
  updateTaskStatus(id, payload) { return this.request(`/tasks/${id}/status`, { method: 'PATCH', body: payload }); },
  inventoryMovements(params = {}) { const qs = new URLSearchParams(params).toString(); return this.request(`/inventory/movements${qs ? `?${qs}` : ''}`); },

  // ----- Módulo de habitaciones -----
  // GET /rooms devuelve { summary, rooms }. only_active=0 incluye las fuera de servicio.
  rooms(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/rooms${qs ? `?${qs}` : ''}`);
  },
  createRoom(payload) { return this.request('/rooms', { method: 'POST', body: payload }); },
  updateRoom(id, payload) { return this.request(`/rooms/${id}`, { method: 'PUT', body: payload }); },
  // Cambia el estado (disponible | limpieza | mantenimiento). 'ocupada' solo cambia con check-in/out.
  updateRoomStatus(id, status) { return this.request(`/rooms/${id}/status`, { method: 'PATCH', body: { status } }); },

  rates(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/rates${qs ? `?${qs}` : ''}`);
  },
  createRate(payload) { return this.request('/rates', { method: 'POST', body: payload }); },
  updateRate(id, payload) { return this.request(`/rates/${id}`, { method: 'PUT', body: payload }); },

  stays(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/stays${qs ? `?${qs}` : ''}`);
  },
  createStay(payload) { return this.request('/stays', { method: 'POST', body: payload }); },
  // GET /stays/{id} devuelve { stay, total_paid }.
  stay(id) { return this.request(`/stays/${id}`); },
  checkoutStay(id, payload = {}) { return this.request(`/stays/${id}/checkout`, { method: 'POST', body: payload }); },
  extendStay(id, payload) { return this.request(`/stays/${id}/extend`, { method: 'POST', body: payload }); },
  chargeStay(id, payload) { return this.request(`/stays/${id}/charge`, { method: 'POST', body: payload }); },

  users() { return this.request('/users'); },
  createUser(payload) { return this.request('/users', { method: 'POST', body: payload }); },
  updateUser(id, payload) { return this.request(`/users/${id}`, { method: 'PUT', body: payload }); },
};
