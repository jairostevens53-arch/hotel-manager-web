// Flujos operativos adicionales. Todas las listas y mutaciones usan la API compartida.
const op = (id) => document.getElementById(id);
const opList = (r) => Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
const opError = (id, error) => { const el = op(id); el.textContent = error.message; el.hidden = false; };
const opDate = (v) => v ? new Date(v).toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/El_Salvador' }) : '—';
const elSalvadorDateInput = (value) => new Date(`${value}:00-06:00`).toISOString();
const opStatus = (s) => `<span class="status-badge ${['confirmada','activa','completada','asignada','en_progreso'].includes(s) ? 'status-active' : 'status-inactive'}">${esc(s || '—')}</span>`;
let guestPage = 1, guestQuery = '', editingGuest = null, reservationPage = 1, taskPage = 1, movementPage = 1;
let guestRecords = [], reservationRecords = [], taskRecords = [], taskAssignees = [], taskRooms = [], reservationRooms = [], reservationRates = [], directRooms = [], directRates = [], currentShift = null, saleProducts = [], checkInReservationId = null;
const opsSearchDebounce = (fn) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), 250); }; };

async function loadGuests(page = 1) {
  guestPage = page;
  const body = op('guests-tbody'); body.innerHTML = '<tr><td colspan="5" class="muted">Cargando huéspedes…</td></tr>';
  try {
    const result = await Api.guests({ page, per_page: 20, ...(guestQuery ? { q: guestQuery } : {}) });
    guestRecords = opList(result);
    renderPager('guests-pager', result, loadGuests);
    body.innerHTML = guestRecords.length ? guestRecords.map((g) => `<tr><td>${esc(g.name)}</td><td>${esc(g.document || '—')}</td><td>${esc(g.phone || '—')}</td><td>${esc(g.email || '—')}</td><td><button class="btn-secondary btn-small" data-edit-guest="${g.id}">Editar</button></td></tr>`).join('') : '<tr><td colspan="5" class="muted">No hay huéspedes que coincidan con la búsqueda.</td></tr>';
  } catch (e) { body.innerHTML = `<tr><td colspan="5" class="muted">Error: ${esc(e.message)}</td></tr>`; }
}
op('guest-search').addEventListener('input', opsSearchDebounce((e) => { guestQuery = e.target.value.trim(); loadGuests(1); }));
function openGuest(guest = null) {
  editingGuest = guest?.id || null; op('guest-form').reset(); op('guest-form-error').hidden = true;
  op('guest-modal-title').textContent = guest ? 'Editar huésped' : 'Nuevo huésped';
  if (guest) for (const [key, id] of Object.entries({name:'gf-name',document:'gf-document',phone:'gf-phone',email:'gf-email',notes:'gf-notes'})) op(id).value = guest[key] || '';
  op('guest-modal').hidden = false; op('gf-name').focus();
}

function fillRatesForRoom(roomSelectId, rateSelectId, rooms, rates) {
  const room = rooms.find((r) => String(r.id) === op(roomSelectId).value);
  const applicable = rates.filter((r) => !r.room_type || r.room_type === room?.type);
  op(rateSelectId).innerHTML = applicable.map((r) => `<option value="${r.id}">${esc(r.name)} · ${money(r.price)}</option>`).join('');
}
op('new-guest-btn').addEventListener('click', () => openGuest());
op('guests-tbody').addEventListener('click', (e) => { const b = e.target.closest('[data-edit-guest]'); if (b) openGuest(guestRecords.find((g) => String(g.id) === b.dataset.editGuest)); });
op('guest-form').addEventListener('submit', async (e) => {
  e.preventDefault(); op('guest-form-error').hidden = true;
  const payload = { name: op('gf-name').value.trim(), document: op('gf-document').value.trim() || null, phone: op('gf-phone').value.trim() || null, email: op('gf-email').value.trim() || null, notes: op('gf-notes').value.trim() || null };
  try { await (editingGuest ? Api.updateGuest(editingGuest, payload) : Api.createGuest(payload)); op('guest-modal').hidden = true; await loadGuests(guestPage); }
  catch (err) { opError('guest-form-error', err); }
});

async function loadReservations(page = 1) {
  reservationPage = page;
  const body = op('reservations-tbody'); body.innerHTML = '<tr><td colspan="7" class="muted">Cargando reservas…</td></tr>';
  try {
    const status = op('reservation-filter-status').value;
    const from = op('reservation-filter-from').value, to = op('reservation-filter-to').value;
    const result = await Api.reservations({ page, per_page: 20, ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) });
    reservationRecords = opList(result); renderPager('reservations-pager', result, loadReservations);
    body.innerHTML = reservationRecords.length ? reservationRecords.map((r) => `<tr><td>${esc(r.guest?.name || '—')}</td><td>${esc(r.room?.number || '—')}</td><td>${esc(r.rate?.name || '—')}</td><td>${opDate(r.check_in_at)}</td><td>${opDate(r.expected_checkout_at)}</td><td>${opStatus(r.status)}</td><td class="row-actions">${r.status === 'confirmada' ? `<button class="btn-primary btn-small" data-checkin-reservation="${r.id}">Check-in</button><button class="btn-secondary btn-small" data-cancel-reservation="${r.id}">Cancelar</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="7" class="muted">No hay reservas para mostrar.</td></tr>';
  } catch (e) { body.innerHTML = `<tr><td colspan="7" class="muted">Error: ${esc(e.message)}</td></tr>`; }
}
op('reservation-filter-status').addEventListener('change', () => loadReservations(1));
op('reservation-filter-from').addEventListener('change', () => loadReservations(1));
op('reservation-filter-to').addEventListener('change', () => loadReservations(1));
async function openReservationForm() {
  op('reservation-form').reset(); op('reservation-form-error').hidden = true;
  op('reservation-modal').hidden = false;
  try {
    const [guests, roomsResult, rates] = await Promise.all([Api.guests({ per_page: 100 }), Api.rooms(), Api.rates()]);
    const rooms = roomsResult.rooms || [];
    reservationRooms = rooms.filter((r) => r.active && r.status === 'disponible'); reservationRates = rates;
    op('res-guest').innerHTML = opList(guests).map((g) => `<option value="${g.id}">${esc(g.name)}${g.document ? ` · ${esc(g.document)}` : ''}</option>`).join('');
    op('res-room').innerHTML = reservationRooms.map((r) => `<option value="${r.id}">${esc(r.number)} · ${esc(r.type)} · ${r.beds} camas</option>`).join('');
    fillRatesForRoom('res-room', 'res-rate', reservationRooms, reservationRates);
    if (!op('res-guest').options.length || !op('res-room').options.length || !op('res-rate').options.length) throw new Error('Se requiere al menos un huésped, una habitación disponible y una tarifa activa.');
  } catch (err) { opError('reservation-form-error', err); }
}
op('new-reservation-btn').addEventListener('click', openReservationForm);
op('res-room').addEventListener('change', () => fillRatesForRoom('res-room', 'res-rate', reservationRooms, reservationRates));
op('reservation-form').addEventListener('submit', async (e) => {
  e.preventDefault(); op('reservation-form-error').hidden = true;
  const payload = { guest_id: Number(op('res-guest').value), room_id: Number(op('res-room').value), rate_id: Number(op('res-rate').value), check_in_at: elSalvadorDateInput(op('res-checkin').value), expected_checkout_at: elSalvadorDateInput(op('res-checkout').value), guests: Number(op('res-guests').value) || 1, notes: op('res-notes').value.trim() || null };
  try { await Api.createReservation(payload); op('reservation-modal').hidden = true; await loadReservations(1); }
  catch (err) { opError('reservation-form-error', err); }
});
op('reservations-tbody').addEventListener('click', async (e) => {
  const checkin = e.target.closest('[data-checkin-reservation]'); const cancel = e.target.closest('[data-cancel-reservation]');
  try {
    if (checkin) {
      checkInReservationId = checkin.dataset.checkinReservation;
      op('checkin-form-error').hidden = true; op('checkin-form').reset(); op('checkin-modal').hidden = false;
    }
    if (cancel) {
      if (!confirm('¿Cancelar esta reserva? Esta acción cambia su estado y no se revierte automáticamente.')) return;
      await Api.cancelReservation(cancel.dataset.cancelReservation); await loadReservations(reservationPage);
    }
  } catch (err) { alert(`No se pudo completar la operación: ${err.message}`); }
});
op('checkin-form').addEventListener('submit', async (e) => {
  e.preventDefault(); op('checkin-form-error').hidden = true;
  try {
    await Api.checkInReservation(checkInReservationId, { payment_method: op('checkin-method').value });
    op('checkin-modal').hidden = true;
    await Promise.all([loadReservations(reservationPage), loadRooms(), loadCurrentShift(), loadSales()]);
  } catch (err) { opError('checkin-form-error', err); }
});

op('direct-checkin-btn').addEventListener('click', async () => {
  op('direct-checkin-form').reset(); op('direct-checkin-error').hidden = true; op('direct-checkin-modal').hidden = false;
  op('direct-guest-name').required = true;
  try {
    const [guests, roomResult, rates] = await Promise.all([Api.guests({ per_page: 100 }), Api.rooms(), Api.rates()]);
    op('direct-guest').innerHTML = '<option value="">Registrar huésped nuevo</option>' + opList(guests).map((g) => `<option value="${g.id}" data-name="${esc(g.name)}" data-document="${esc(g.document || '')}">${esc(g.name)}</option>`).join('');
    directRooms = (roomResult.rooms || []).filter((r) => r.active && r.status === 'disponible'); directRates = rates;
    op('direct-room').innerHTML = directRooms.map((r) => `<option value="${r.id}">${esc(r.number)} · ${esc(r.type)} · ${r.beds} camas</option>`).join('');
    fillRatesForRoom('direct-room', 'direct-rate', directRooms, directRates);
    if (!op('direct-room').options.length || !op('direct-rate').options.length) throw new Error('Se requiere una habitación disponible y una tarifa activa.');
  } catch (err) { opError('direct-checkin-error', err); }
});
op('direct-room').addEventListener('change', () => fillRatesForRoom('direct-room', 'direct-rate', directRooms, directRates));
op('direct-guest').addEventListener('change', (e) => {
  const selected = e.target.selectedOptions[0];
  op('direct-guest-name').required = !e.target.value;
  if (e.target.value) { op('direct-guest-name').value = selected.dataset.name; op('direct-guest-document').value = selected.dataset.document; }
  else { op('direct-guest-name').value = ''; op('direct-guest-document').value = ''; }
});
op('direct-checkin-form').addEventListener('submit', async (e) => {
  e.preventDefault(); op('direct-checkin-error').hidden = true;
  const guestId = op('direct-guest').value;
  const payload = { room_id: Number(op('direct-room').value), rate_id: Number(op('direct-rate').value), payment_method: op('direct-method').value };
  if (guestId) payload.guest_id = Number(guestId);
  else { payload.guest_name = op('direct-guest-name').value.trim(); payload.guest_document = op('direct-guest-document').value.trim() || null; }
  try { await Api.createStay(payload); op('direct-checkin-modal').hidden = true; await Promise.all([loadStays(1), loadRooms(), loadCurrentShift(), loadSales()]); }
  catch (err) { opError('direct-checkin-error', err); }
});

let stayAction = 'extend';
function openStayAction(kind) {
  stayAction = kind; op('stay-charge-form').reset(); op('stay-charge-error').hidden = true;
  const extending = kind === 'extend';
  op('stay-charge-title').textContent = extending ? 'Extender estadía' : 'Agregar cargo';
  op('stay-hours-row').hidden = !extending; op('stay-charge-amount-row').hidden = extending; op('stay-charge-description-row').hidden = extending;
  op('stay-charge-modal').hidden = false;
}
op('stay-extend-btn').addEventListener('click', () => openStayAction('extend'));
op('stay-charge-btn').addEventListener('click', () => openStayAction('charge'));
op('stay-charge-form').addEventListener('submit', async (e) => {
  e.preventDefault(); op('stay-charge-error').hidden = true;
  const method = op('stay-operation-method').value;
  try {
    if (stayAction === 'extend') await Api.extendStay(currentStayId, { hours: Number(op('stay-hours').value), payment_method: method });
    else await Api.chargeStay(currentStayId, { amount: Number(op('stay-charge-amount').value), description: op('stay-charge-description').value.trim() || null, payment_method: method });
    op('stay-charge-modal').hidden = true; await Promise.all([showStayDetail(currentStayId), loadSales(), loadCurrentShift()]);
  } catch (err) { opError('stay-charge-error', err); }
});

async function loadTasks(page = 1) {
  taskPage = page; const body = op('tasks-tbody'); body.innerHTML = '<tr><td colspan="7" class="muted">Cargando tareas…</td></tr>';
  try {
    const params = { page, per_page: 20 };
    if (op('task-filter-status').value) params.status = op('task-filter-status').value;
    if (op('task-filter-type').value && ['admin','recepcionista'].includes(Api.getUser()?.role)) params.type = op('task-filter-type').value;
    const role = Api.getUser()?.role;
    const [result] = await Promise.all([Api.tasks(params), (role === 'admin' ? Api.users().then((users) => { taskAssignees = opList(users).filter((u) => u.active); }).catch(() => { taskAssignees = []; }) : Promise.resolve())]);
    taskRecords = opList(result); renderPager('tasks-pager', result, loadTasks);
    body.innerHTML = taskRecords.length ? taskRecords.map((t) => {
      const next = t.status === 'pendiente' || t.status === 'asignada' ? 'en_progreso' : (t.status === 'en_progreso' ? 'completada' : '');
      const canUpdate = ['admin','recepcionista'].includes(role) || (Number(t.assigned_to) === Number(Api.getUser()?.id) && t.type === role);
      const assignable = taskAssignees.filter((u) => u.role === t.type);
      const assignment = role === 'admin' && ['pendiente','asignada'].includes(t.status) && assignable.length
        ? `<select aria-label="Asignar tarea a" class="task-assignee">${assignable.map((u) => `<option value="${u.id}" ${Number(u.id) === Number(t.assigned_to) ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select><button class="btn-secondary btn-small" data-assign-task="${t.id}">Asignar</button>`
        : '';
      return `<tr><td>${esc(t.room?.number || '—')}</td><td>${esc(t.type)}</td><td>${esc(t.priority)}</td><td>${esc(t.description || '—')}</td><td>${esc(t.assignee?.name || 'Sin asignar')} ${assignment}</td><td>${opStatus(t.status)}</td><td>${canUpdate && next ? `<button class="btn-secondary btn-small" data-task-next="${t.id}" data-next-status="${next}">${next === 'completada' ? 'Completar' : 'Iniciar'}</button>` : ''}</td></tr>`;
    }).join('') : '<tr><td colspan="7" class="muted">No hay tareas para estos filtros.</td></tr>';
    op('new-task-btn').hidden = !['admin','recepcionista'].includes(role);
  } catch (e) { body.innerHTML = `<tr><td colspan="7" class="muted">Error: ${esc(e.message)}</td></tr>`; }
}
op('task-filter-status').addEventListener('change', () => loadTasks(1)); op('task-filter-type').addEventListener('change', () => loadTasks(1));
op('new-task-btn').addEventListener('click', async () => {
  op('task-form').reset(); op('task-form-error').hidden = true; op('task-modal').hidden = false;
  try { const { rooms = [] } = await Api.rooms(); taskRooms = rooms; renderTaskRooms(); if (!op('task-room').options.length) throw new Error('No hay habitaciones disponibles para esta tarea.'); }
  catch (err) { opError('task-form-error', err); }
});
function renderTaskRooms() {
  const type = op('task-type').value;
  op('task-room').innerHTML = taskRooms.filter((r) => r.active && (r.status === 'disponible' || r.status === type)).map((r) => `<option value="${r.id}">${esc(r.number)} · ${esc(r.status)}</option>`).join('');
}
op('task-type').addEventListener('change', renderTaskRooms);
op('task-form').addEventListener('submit', async (e) => {
  e.preventDefault(); op('task-form-error').hidden = true;
  try { await Api.createTask({ room_id: Number(op('task-room').value), type: op('task-type').value, priority: op('task-priority').value, description: op('task-description').value.trim() || null }); op('task-modal').hidden = true; await Promise.all([loadTasks(1), loadRooms()]); }
  catch (err) { opError('task-form-error', err); }
});
op('tasks-tbody').addEventListener('click', async (e) => {
  const assign = e.target.closest('[data-assign-task]'); const next = e.target.closest('[data-task-next]');
  try {
    if (assign) {
      const id = assign.closest('tr').querySelector('.task-assignee').value;
      if (!id) throw new Error('Selecciona un usuario con el rol correspondiente.');
      await Api.assignTask(assign.dataset.assignTask, Number(id));
    }
    if (next) {
      if (next.dataset.nextStatus === 'completada' && !confirm('¿Marcar esta tarea como completada?')) return;
      await Api.updateTaskStatus(next.dataset.taskNext, { status: next.dataset.nextStatus });
    }
    if (assign || next) await Promise.all([loadTasks(taskPage), loadRooms()]);
  } catch (err) { alert(`No se pudo actualizar la tarea: ${err.message}`); }
});

async function loadCurrentShift() {
  const panel = op('current-shift-panel'); panel.innerHTML = '<p class="muted">Consultando el turno actual con el servidor…</p>';
  op('open-shift-btn').hidden = op('close-shift-btn').hidden = op('new-expense-btn').hidden = op('new-sale-btn').hidden = true;
  try {
    currentShift = await Api.currentShift();
    panel.innerHTML = `<h2>Turno abierto</h2><ul class="simple-list"><li><span>Abierto</span><span>${opDate(currentShift.opened_at)}</span></li><li><span>Fondo inicial</span><strong>${money(currentShift.opening_amount)}</strong></li><li><span>Estado</span><span>${opStatus('abierto')}</span></li></ul><p class="muted">El efectivo esperado y la diferencia oficiales se calculan en el servidor al cerrar el turno.</p>`;
    op('close-shift-btn').hidden = op('new-expense-btn').hidden = op('new-sale-btn').hidden = false;
  } catch (err) {
    currentShift = null;
    if (err.status === 404) { panel.innerHTML = '<h2>Sin turno abierto</h2><p class="muted">Abre un turno antes de registrar ventas, gastos o check-in.</p>'; op('open-shift-btn').hidden = false; }
    else panel.innerHTML = `<p class="login-error">No se pudo consultar el turno: ${esc(err.message)}</p>`;
  }
}
function openCashForm(kind) {
  op('cash-form').reset(); op('cash-form-error').hidden = true; op('cash-form').dataset.kind = kind;
  op('cash-modal-title').textContent = kind === 'open' ? 'Abrir turno' : kind === 'close' ? 'Cerrar turno' : 'Registrar gasto';
  op('cash-amount-label').textContent = kind === 'open' ? 'Fondo inicial' : kind === 'close' ? 'Efectivo contado' : 'Monto';
  op('cash-amount').min = kind === 'expense' ? '0.01' : '0'; op('cash-description-row').hidden = kind !== 'expense'; op('cash-notes-row').hidden = kind !== 'close'; op('cash-modal').hidden = false;
}
op('open-shift-btn').addEventListener('click', () => openCashForm('open'));
op('close-shift-btn').addEventListener('click', () => openCashForm('close'));
op('new-expense-btn').addEventListener('click', () => openCashForm('expense'));
op('cash-form').addEventListener('submit', async (e) => {
  e.preventDefault(); const kind = e.currentTarget.dataset.kind; op('cash-form-error').hidden = true;
  const amount = Number(op('cash-amount').value);
  if (kind === 'close' && !confirm('¿Cerrar el turno con el monto contado ingresado? El cierre no se puede revertir.')) return;
  try {
    if (kind === 'open') { await Api.openShift({ opening_amount: amount }); }
    if (kind === 'expense') { await Api.createExpense({ amount, description: op('cash-description').value.trim() }); await loadExpenses(); }
    if (kind === 'close') {
      const result = await Api.closeShift({ counted_amount: amount, notes: op('cash-notes').value.trim() || null });
      const s = result.shift, summary = result.summary;
      op('current-shift-panel').innerHTML = `<h2>Turno cerrado</h2><ul class="simple-list"><li><span>Fondo inicial</span><strong>${money(summary.opening_amount)}</strong></li><li><span>Ventas en efectivo</span><strong>${money(summary.cash_sales)}</strong></li><li><span>Ventas con tarjeta</span><strong>${money(summary.card_sales)}</strong></li><li><span>Ventas por transferencia</span><strong>${money(summary.transfer_sales)}</strong></li><li><span>Gastos</span><strong>${money(summary.expenses)}</strong></li><li><span>Efectivo esperado</span><strong>${money(summary.expected_amount)}</strong></li><li><span>Efectivo contado</span><strong>${money(s.counted_amount)}</strong></li><li><span>Diferencia</span><strong>${money(s.difference)}</strong></li></ul>`;
      op('open-shift-btn').hidden = false; op('close-shift-btn').hidden = op('new-expense-btn').hidden = op('new-sale-btn').hidden = true;
      if (Api.getUser()?.role === 'admin') await loadShifts();
    }
    op('cash-modal').hidden = true;
    if (kind !== 'close') await loadCurrentShift();
  } catch (err) { opError('cash-form-error', err); }
});

async function loadInventoryMovements(page = 1) {
  movementPage = page; const body = op('movements-tbody'); body.innerHTML = '<tr><td colspan="6" class="muted">Cargando movimientos…</td></tr>';
  try {
    const params = { page, per_page: 20 };
    if (op('movement-filter-product').value) params.product_id = op('movement-filter-product').value;
    if (op('movement-filter-type').value) params.type = op('movement-filter-type').value;
    if (op('movement-filter-from').value) params.from = op('movement-filter-from').value;
    if (op('movement-filter-to').value) params.to = op('movement-filter-to').value;
    const result = await Api.inventoryMovements(params); const rows = opList(result); renderPager('movements-pager', result, loadInventoryMovements);
    body.innerHTML = rows.length ? rows.map((m) => `<tr><td>${opDate(m.created_at)}</td><td>${esc(m.product?.name || `#${m.product_id}`)}</td><td>${esc(m.type)}</td><td class="${Number(m.quantity) < 0 ? 'stock-low' : 'diff-positive'}">${Number(m.quantity) > 0 ? '+' : ''}${esc(m.quantity)}</td><td>${esc(m.reason || '—')}</td><td>${esc(m.user?.name || '—')}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">No hay movimientos que coincidan con los filtros.</td></tr>';
  } catch (e) { body.innerHTML = `<tr><td colspan="6" class="muted">Error: ${esc(e.message)}</td></tr>`; }
}
['movement-filter-product','movement-filter-type','movement-filter-from','movement-filter-to'].forEach((id) => op(id).addEventListener('change', () => loadInventoryMovements(1)));
async function loadMovementProducts() {
  try { const products = opList(await Api.products('', true)); op('movement-filter-product').innerHTML = '<option value="">Todos los productos</option>' + products.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join(''); }
  catch (err) { op('movement-filter-product').innerHTML = '<option value="">No se pudieron cargar los productos</option>'; }
}

function addSaleLine() {
  const row = document.createElement('div'); row.className = 'purchase-item-row sale-item-row';
  row.innerHTML = `<select aria-label="Producto" required></select><input type="number" aria-label="Cantidad" min="1" step="1" value="1" required><button type="button" class="pi-remove" aria-label="Quitar producto">×</button>`;
  row.querySelector('select').innerHTML = saleProducts.filter((p) => p.active && p.stock > 0).map((p) => `<option value="${p.id}">${esc(p.name)} · stock ${esc(p.stock)} · ${money(p.price)}</option>`).join('');
  row.querySelector('.pi-remove').addEventListener('click', () => row.remove()); op('sale-lines').append(row);
}
op('new-sale-btn').addEventListener('click', async () => {
  op('sale-form').reset(); op('sale-form-error').hidden = true; op('sale-lines').innerHTML = ''; op('sale-form-modal').hidden = false;
  try { saleProducts = opList(await Api.products()); addSaleLine(); if (!op('sale-lines select').options.length) throw new Error('No hay productos con stock disponible.'); }
  catch (err) { opError('sale-form-error', err); }
});
op('sale-add-line').addEventListener('click', addSaleLine);
op('sale-form').addEventListener('submit', async (e) => {
  e.preventDefault(); op('sale-form-error').hidden = true;
  const items = [...op('sale-lines').querySelectorAll('.sale-item-row')].map((row) => ({ product_id: Number(row.querySelector('select').value), quantity: Number(row.querySelector('input').value) }));
  if (!items.length || items.some((x) => !x.product_id || x.quantity < 1)) { opError('sale-form-error', new Error('Agrega al menos un producto con cantidad válida.')); return; }
  try {
    await Api.createSale({ payment_method: op('sale-method').value, items }); op('sale-form-modal').hidden = true;
    const refreshes = [loadSales(), loadProducts(), loadCurrentShift()];
    if (Api.getUser()?.role === 'admin') refreshes.push(loadDashboard(), loadInventoryMovements());
    await Promise.all(refreshes);
  }
  catch (err) { opError('sale-form-error', err); }
});

document.querySelectorAll('[data-close-modal]').forEach((b) => b.addEventListener('click', () => { op(b.dataset.closeModal).hidden = true; }));
document.querySelectorAll('.modal-overlay').forEach((m) => {
  const title = m.querySelector('h2');
  if (title) { if (!title.id) title.id = `${m.id}-heading`; m.setAttribute('aria-labelledby', title.id); }
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const modal = [...document.querySelectorAll('.modal-overlay:not([hidden])')].at(-1);
  if (!modal) return;
  const controls = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter((el) => el.getClientRects().length);
  if (!controls.length) return;
  const first = controls[0], last = controls[controls.length - 1];
  if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

// Ordenamiento local accesible sobre las filas que ya devolvió el API (no cambia los datos).
document.querySelectorAll('.data-table').forEach((table) => {
  if (!table.parentElement.classList.contains('table-wrap')) {
    const wrapper = document.createElement('div'); wrapper.className = 'table-wrap';
    table.parentElement.insertBefore(wrapper, table); wrapper.appendChild(table);
  }
  table.querySelectorAll('thead th').forEach((th) => {
    if (!th.textContent.trim()) return;
    th.tabIndex = 0; th.classList.add('sortable'); th.title = `Ordenar por ${th.textContent.trim()}`;
  });
  const sortByHeader = (th) => {
    const index = [...th.parentElement.children].indexOf(th); const tbody = table.tBodies[0];
    if (!tbody) return;
    const direction = th.dataset.sortDirection === 'asc' ? 'desc' : 'asc';
    table.querySelectorAll('thead th').forEach((h) => { h.removeAttribute('aria-sort'); if (h !== th) delete h.dataset.sortDirection; });
    th.dataset.sortDirection = direction; th.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
    const dateValue = (value) => {
      const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,\s*(.*))?$/);
      if (!match) return null;
      const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
      const time = match[4] ? Date.parse(`${year}-${match[2]}-${match[1]} ${match[4]}`) : 0;
      return Number.isNaN(time) ? new Date(year, Number(match[2]) - 1, Number(match[1])).getTime() : time;
    };
    [...tbody.rows].sort((a, b) => {
      const av = a.cells[index]?.innerText.trim() || '', bv = b.cells[index]?.innerText.trim() || '';
      const ad = dateValue(av), bd = dateValue(bv);
      const cmp = ad !== null && bd !== null ? ad - bd : av.localeCompare(bv, 'es', { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? cmp : -cmp;
    }).forEach((row) => tbody.appendChild(row));
  };
  table.addEventListener('click', (e) => { const th = e.target.closest('thead th.sortable'); if (th) sortByHeader(th); });
  table.addEventListener('keydown', (e) => { const th = e.target.closest('thead th.sortable'); if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sortByHeader(th); } });
});
