const eventModal = bootstrap.Modal.getOrCreateInstance(document.querySelector('#event-modal'));
const registrationModal = bootstrap.Modal.getOrCreateInstance(document.querySelector('#register-modal'));
let activeCategory = 'all';
let editingEventId = null;

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
  return data;
}
function filterEvents() {
  const query = document.querySelector('#event-search').value.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll('.event-card').forEach((card) => {
    const matches = (activeCategory === 'all' || card.dataset.category === activeCategory) && card.dataset.search.includes(query);
    card.classList.toggle('d-none', !matches);
    if (matches) shown += 1;
  });
  document.querySelector('#no-results').classList.toggle('d-none', shown !== 0 || document.querySelectorAll('.event-card').length === 0);
}
document.querySelectorAll('.category-chip').forEach((button) => button.addEventListener('click', () => {
  document.querySelector('.category-chip.selected').classList.remove('selected');
  button.classList.add('selected');
  activeCategory = button.dataset.category;
  filterEvents();
}));
document.querySelector('#event-search').addEventListener('input', filterEvents);

document.querySelector('#event-grid').addEventListener('click', (event) => {
  const manageButton = event.target.closest('button[data-action]');
  if (manageButton) {
    manageEvent(manageButton.dataset.action, Number(manageButton.dataset.eventId));
    return;
  }
  const button = event.target.closest('.register-link');
  if (!button || button.disabled) return;
  document.querySelector('#register-event-id').value = button.dataset.eventId;
  document.querySelector('#register-event-title').textContent = button.dataset.eventTitle;
  document.querySelector('#registration-feedback').textContent = '';
  document.querySelector('#registration-feedback').classList.remove('success');
  document.querySelector('#registration-form').reset();
  document.querySelector('#student-name').disabled = false;
  document.querySelector('#student-email').disabled = false;
  document.querySelector('#register-submit').disabled = false;
  document.querySelector('#register-submit').textContent = 'Confirm registration';
  registrationModal.show();
});

async function manageEvent(action, id) {
  try {
    if (action === 'delete') {
      if (!window.confirm('Delete this event and all its registrations?')) return;
      await api(`/api/events/${id}`, { method: 'DELETE' });
      await refreshEvents();
      return;
    }
    const item = await api(`/api/events/${id}`);
    editingEventId = id;
    document.querySelector('#event-title').value = item.title;
    document.querySelector('#event-category').value = item.category;
    document.querySelector('#event-capacity').value = item.capacity;
    document.querySelector('#event-date').value = item.event_date;
    document.querySelector('#event-time').value = item.event_time;
    document.querySelector('#event-location').value = item.location;
    document.querySelector('#event-description').value = item.description;
    document.querySelector('#event-modal-title').textContent = 'Edit event';
    document.querySelector('#event-submit').textContent = 'Save changes';
    eventModal.show();
  } catch (error) { window.alert(error.message); }
}

document.querySelector('#event-modal').addEventListener('hidden.bs.modal', () => {
  editingEventId = null;
  document.querySelector('#event-form').reset();
  document.querySelector('#event-modal-title').textContent = 'Host an event';
  document.querySelector('#event-submit').textContent = 'Publish event';
  document.querySelector('#event-feedback').textContent = '';
});

document.querySelector('#registration-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = document.querySelector('#register-submit');
  const message = document.querySelector('#registration-feedback');
  submit.disabled = true;
  message.textContent = '';
  try {
    await api(`/api/events/${document.querySelector('#register-event-id').value}/register`, { method: 'POST', body: JSON.stringify({ student_name: document.querySelector('#student-name').value.trim(), student_email: document.querySelector('#student-email').value.trim() }) });
    message.textContent = 'You are registered! See you there.';
    message.classList.add('success');
    submit.textContent = 'Registered ✓';
    document.querySelector('#student-name').disabled = true;
    document.querySelector('#student-email').disabled = true;
    await refreshEvents();
    window.setTimeout(() => registrationModal.hide(), 1300);
  } catch (error) { message.textContent = error.message; }
  finally { submit.disabled = false; }
});

document.querySelector('#event-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = document.querySelector('#event-submit');
  const feedback = document.querySelector('#event-feedback');
  feedback.textContent = '';
  submit.disabled = true;
  const body = {
    title: document.querySelector('#event-title').value.trim(), category: document.querySelector('#event-category').value,
    capacity: Number(document.querySelector('#event-capacity').value), event_date: document.querySelector('#event-date').value,
    event_time: document.querySelector('#event-time').value, location: document.querySelector('#event-location').value.trim(),
    description: document.querySelector('#event-description').value.trim()
  };
  try {
    await api(editingEventId ? `/api/events/${editingEventId}` : '/api/events', { method: editingEventId ? 'PUT' : 'POST', body: JSON.stringify(body) });
    eventModal.hide();
    document.querySelector('#event-form').reset();
    await refreshEvents();
    document.querySelector('#events').scrollIntoView({ behavior: 'smooth' });
  } catch (error) { feedback.textContent = error.message; }
  finally { submit.disabled = false; }
});

async function refreshEvents() {
  const events = await api('/api/events');
  const grid = document.querySelector('#event-grid');
  const palettes = ['coral', 'violet', 'mint', 'yellow'];
  const symbols = ['✳', '✦', '◈', '✺'];
  const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short' });
  const safe = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  grid.innerHTML = events.map((item, index) => {
    const date = new Date(`${item.event_date}T00:00:00`);
    return `<article class="event-card" data-category="${safe(item.category)}" data-search="${safe(`${item.title} ${item.category} ${item.location}`.toLowerCase())}"><div class="event-visual ${palettes[index % 4]}"><span class="visual-label">${safe(item.category.toUpperCase())}</span><span class="visual-art" aria-hidden="true">${symbols[index % 4]}</span><div class="date-stamp"><strong>${date.getDate()}</strong><span>${dateFormat.format(date).toUpperCase()}</span></div><span class="visual-index">NO. ${String(index + 1).padStart(2, '0')}</span></div><div class="event-info"><div class="event-meta"><span>◷ &nbsp;${safe(item.event_time)}</span><span>${item.spots_left} spots left</span></div><h3>${safe(item.title)}</h3><p class="event-location">⌖ &nbsp;${safe(item.location)}</p><p class="event-description">${safe(item.description)}</p><button class="register-link" data-event-id="${item.id}" data-event-title="${safe(item.title)}" ${item.spots_left === 0 ? 'disabled' : ''}>${item.spots_left === 0 ? 'Event full' : 'Get your spot'} <span>↗</span></button><div class="event-management"><span>Organizer tools</span><div><button data-action="edit" data-event-id="${item.id}">Edit</button><button data-action="delete" data-event-id="${item.id}">Delete</button></div></div></div></article>`;
  }).join('');
  document.querySelector('#no-events').classList.toggle('d-none', events.length > 0);
  filterEvents();
}

const today = new Date();
document.querySelector('#event-date').min = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
