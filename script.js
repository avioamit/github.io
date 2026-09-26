const year = document.getElementById('year');
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
const registrationForm = document.getElementById('registration-form');
const formSuccess = document.getElementById('form-success');
const eventsList = document.getElementById('events-list');
const adminLoginForm = document.getElementById('admin-login-form');
const adminLoginMessage = document.getElementById('admin-login-message');
const adminEventList = document.getElementById('admin-event-list');
const loginPanel = document.getElementById('login-panel');
const adminPanel = document.getElementById('admin-panel');
const logoutBtn = document.getElementById('logout-btn');
const addEventForm = document.getElementById('add-event-form');
const addEventMessage = document.getElementById('add-event-message');
const eventDateInput = document.getElementById('event-date');
const eventImageInput = document.getElementById('event-image-upload');
const eventImagePreview = document.getElementById('event-image-preview');
const calendarGrid = document.getElementById('calendar-grid');
const calendarMonthLabel = document.getElementById('calendar-month-label');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const fallbackEvents = [
  {
    id: 1,
    title: 'Navratri Festival',
    date: 'Sep 28',
    description: 'Daily prayers, cultural dance, and evening aarti with community participation.'
  },
  {
    id: 2,
    title: 'Diwali Lights Celebration',
    date: 'Oct 12',
    description: 'An evening of prayer, decorations, and festive joy for all families.'
  },
  {
    id: 3,
    title: 'Bhakti Satsang',
    date: 'Nov 03',
    description: 'An uplifting gathering of devotional singing, reflection, and fellowship.'
  }
];
let calendarViewDate = new Date();
let currentRegistrations = [];

function escapeCsvValue(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function fetchJson(url, options = {}) {
  const isFileProtocol = window.location.protocol === 'file:';
  const apiBase = isFileProtocol ? 'http://localhost:3000' : '';
  const finalUrl = /^https?:\/\//.test(url) ? url : `${apiBase}${url.startsWith('/') ? url : `/${url}`}`;

  try {
    const response = await fetch(finalUrl, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Request failed.');
    }

    return data;
  } catch (error) {
    if (isFileProtocol) {
      throw new Error('The admin page must be opened through a local web server. Run: node server.js and open http://localhost:3000/admin.html');
    }

    throw error;
  }
}

function renderEvents(events) {
  if (!eventsList) {
    return;
  }

  if (!events || events.length === 0) {
    eventsList.innerHTML = '<article class="event-card"><h3>No upcoming events</h3><p>Please check back soon.</p></article>';
    return;
  }

  eventsList.innerHTML = events
    .map(
      (event) => `
        <article class="event-card">
          ${event.image ? `<img class="event-image" src="${event.image}" alt="${event.title}" />` : ''}
          <span class="date">${event.date}</span>
          <h3>${event.title}</h3>
          <p>${event.description}</p>
        </article>
      `
    )
    .join('');
}

async function loadEvents() {
  try {
    const data = await fetchJson('/api/events');
    renderEvents(data.events || fallbackEvents);

    const eventSelect = document.querySelector('select[name="event"]');
    if (eventSelect) {
      eventSelect.innerHTML = '<option value="">Choose an event</option>' + (data.events || fallbackEvents)
        .map((event) => `<option value="${event.title}">${event.title}</option>`)
        .join('');
    }
  } catch (error) {
    renderEvents(fallbackEvents);

    const eventSelect = document.querySelector('select[name="event"]');
    if (eventSelect) {
      eventSelect.innerHTML = '<option value="">Choose an event</option>' + fallbackEvents
        .map((event) => `<option value="${event.title}">${event.title}</option>`)
        .join('');
    }
  }
}

if (year) {
  year.textContent = new Date().getFullYear();
}


if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

if (registrationForm) {
  registrationForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(registrationForm);
    const payload = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      event: formData.get('event'),
      guests: formData.get('guests'),
      time: formData.get('time'),
      message: formData.get('message')
    };

    try {
      const response = await fetch(`${window.location.protocol === 'file:' ? 'http://localhost:3000' : ''}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Registration failed.');
      }

      if (formSuccess) {
        formSuccess.textContent = data.message || 'Registration saved successfully.';
      }

      registrationForm.reset();
      loadEvents();
    } catch (error) {
      if (formSuccess) {
        formSuccess.textContent = error.message || 'Something went wrong. Please try again.';
      }
    }
  });
}

function showLoginPanel() {
  if (loginPanel) loginPanel.classList.remove('hidden');
  if (adminPanel) adminPanel.classList.add('hidden');
}

function showAdminPanel() {
  if (loginPanel) loginPanel.classList.add('hidden');
  if (adminPanel) adminPanel.classList.remove('hidden');
}

async function loadAdminEvents() {
  if (!adminEventList) {
    return;
  }

  try {
    const data = await fetchJson('/api/admin/events');
    adminEventList.innerHTML = (data.events || [])
      .map(
        (event) => `
          <div class="admin-event-card" data-id="${event.id}">
            <div class="admin-event-summary">
              <div class="admin-event-meta">
                <span class="date">${event.date}</span>
                <h3 class="event-summary-title">${event.title}</h3>
              </div>
              <p class="event-summary-description">${event.description}</p>
            </div>

            <div class="admin-event-actions">
              <button type="button" data-id="${event.id}" class="btn btn-secondary edit-event-btn">Edit Event</button>
              <button type="button" data-id="${event.id}" class="btn btn-danger delete-event-btn">Delete Event</button>
            </div>

            <div class="admin-event-editor hidden">
              <label class="field">
                <span>Event Title</span>
                <input type="text" data-field="title" value="${event.title.replace(/"/g, '&quot;')}" />
              </label>

              <label class="field">
                <span>Date</span>
                <input type="text" data-field="date" value="${event.date.replace(/"/g, '&quot;')}" />
              </label>

              <label class="field">
                <span>Description</span>
                <textarea rows="3" data-field="description">${event.description}</textarea>
              </label>

              <label class="field">
                <span>Details</span>
                <textarea rows="3" data-field="details">${event.details || ''}</textarea>
              </label>

              <div class="admin-event-actions">
                <button type="button" data-id="${event.id}" class="btn btn-primary save-event-btn">Save Changes</button>
                <button type="button" class="btn btn-secondary cancel-edit-btn">Cancel</button>
              </div>
            </div>
          </div>
        `
      )
      .join('');

    document.querySelectorAll('.edit-event-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const card = button.closest('.admin-event-card');
        const summary = card.querySelector('.admin-event-summary');
        const editor = card.querySelector('.admin-event-editor');

        summary.classList.add('hidden');
        editor.classList.remove('hidden');
      });
    });

    document.querySelectorAll('.cancel-edit-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const card = button.closest('.admin-event-card');
        const summary = card.querySelector('.admin-event-summary');
        const editor = card.querySelector('.admin-event-editor');

        editor.classList.add('hidden');
        summary.classList.remove('hidden');
      });
    });

    document.querySelectorAll('.save-event-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('.admin-event-card');
        const eventId = button.dataset.id;
        const payload = {
          title: card.querySelector('[data-field="title"]').value,
          date: card.querySelector('[data-field="date"]').value,
          description: card.querySelector('[data-field="description"]').value,
          details: card.querySelector('[data-field="details"]').value
        };

        try {
          const result = await fetchJson(`/api/admin/events/${eventId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });

          if (result.success) {
            const summary = card.querySelector('.admin-event-summary');
            const editor = card.querySelector('.admin-event-editor');
            const titleEl = summary.querySelector('.event-summary-title');
            const descriptionEl = summary.querySelector('.event-summary-description');
            const dateEl = summary.querySelector('.date');

            titleEl.textContent = payload.title;
            descriptionEl.textContent = payload.description;
            dateEl.textContent = payload.date;

            editor.classList.add('hidden');
            summary.classList.remove('hidden');

            await loadEvents();
            if (adminLoginMessage) {
              adminLoginMessage.textContent = 'Event updated successfully.';
            }
          }
        } catch (error) {
          if (adminLoginMessage) {
            adminLoginMessage.textContent = error.message;
          }
        }
      });
    });

    document.querySelectorAll('.delete-event-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const eventId = button.dataset.id;
        const card = button.closest('.admin-event-card');

        if (!window.confirm('Delete this event from the temple calendar?')) {
          return;
        }

        try {
          const result = await fetchJson(`/api/admin/events/${eventId}`, {
            method: 'DELETE'
          });

          if (result.success) {
            if (card) {
              card.remove();
            }
            await loadEvents();
            if (adminLoginMessage) {
              adminLoginMessage.textContent = 'Event deleted successfully.';
            }
          }
        } catch (error) {
          if (adminLoginMessage) {
            adminLoginMessage.textContent = error.message;
          }
        }
      });
    });
  } catch (error) {
    if (adminLoginMessage) {
      adminLoginMessage.textContent = error.message;
    }
  }
}

async function checkAdminSession() {
  if (!adminLoginForm && !adminPanel) {
    return;
  }

  try {
    const data = await fetchJson('/api/admin/session');
    if (data.loggedIn) {
      showAdminPanel();
      await loadAdminEvents();
      await loadRegistrations();
    } else {
      showLoginPanel();
    }
  } catch (error) {
    showLoginPanel();
  }
}

function renderCalendar() {
  if (!calendarGrid || !calendarMonthLabel) {
    return;
  }

  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calendarViewDate);
  calendarMonthLabel.textContent = monthLabel;

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();
  const previousMonthLastDate = new Date(year, month, 0).getDate();

  const cells = [];

  for (let i = 0; i < firstDayIndex; i += 1) {
    const dayNumber = previousMonthLastDate - firstDayIndex + i + 1;
    cells.push({
      day: dayNumber,
      isCurrentMonth: false,
      date: new Date(year, month - 1, dayNumber)
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      isCurrentMonth: true,
      date: new Date(year, month, day)
    });
  }

  const totalCellsNeeded = 42;
  while (cells.length < totalCellsNeeded) {
    const nextDay = cells.length - (daysInMonth + firstDayIndex) + 1;
    cells.push({
      day: nextDay,
      isCurrentMonth: false,
      date: new Date(year, month + 1, nextDay)
    });
  }

  const selectedDateValue = eventDateInput ? eventDateInput.value : '';

  calendarGrid.innerHTML = cells
    .map(({ day, isCurrentMonth, date }) => {
      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const isSelected = selectedDateValue === dateString;
      return `
        <button
          type="button"
          class="calendar-day ${isCurrentMonth ? 'current-month' : 'muted-month'} ${isSelected ? 'selected' : ''}"
          data-date="${dateString}"
          aria-label="Choose date ${dateString}"
        >${day}</button>
      `;
    })
    .join('');

  document.querySelectorAll('.calendar-day').forEach((dayButton) => {
    dayButton.addEventListener('click', () => {
      if (eventDateInput) {
        eventDateInput.value = dayButton.dataset.date;
      }
      renderCalendar();
    });
  });
}

if (prevMonthBtn) {
  prevMonthBtn.addEventListener('click', () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
    renderCalendar();
  });
}

if (nextMonthBtn) {
  nextMonthBtn.addEventListener('click', () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
    renderCalendar();
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });
}

if (eventImageInput && eventImagePreview) {
  eventImageInput.addEventListener('change', async () => {
    const file = eventImageInput.files && eventImageInput.files[0];
    if (!file) {
      eventImagePreview.classList.add('empty');
      eventImagePreview.textContent = 'No image selected';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      eventImagePreview.classList.remove('empty');
      eventImagePreview.style.backgroundImage = `url("${dataUrl}")`;
      eventImagePreview.textContent = '';
    } catch (error) {
      eventImagePreview.classList.add('empty');
      eventImagePreview.textContent = 'Unable to preview image';
    }
  });
}

if (addEventForm) {
  addEventForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(addEventForm);

    let selectedImage = '';
    if (eventImageInput && eventImageInput.files && eventImageInput.files[0]) {
      selectedImage = await readFileAsDataUrl(eventImageInput.files[0]).catch(() => '');
    }

    try {
      const result = await fetchJson('/api/admin/events', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.get('title'),
          date: formData.get('date'),
          description: formData.get('description'),
          details: formData.get('details'),
          image: selectedImage
        })
      });

      if (addEventMessage) {
        addEventMessage.textContent = result.message;
      }

      addEventForm.reset();
      if (eventDateInput) {
        eventDateInput.value = '';
      }
      if (eventImagePreview) {
        eventImagePreview.classList.add('empty');
        eventImagePreview.textContent = 'No image selected';
        eventImagePreview.style.backgroundImage = 'none';
      }
      renderCalendar();
      await loadAdminEvents();
      await loadEvents();
    } catch (error) {
      if (addEventMessage) {
        addEventMessage.textContent = error.message;
      }
    }
  });
}

if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(adminLoginForm);

    try {
      const result = await fetchJson('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          username: formData.get('username'),
          password: formData.get('password')
        })
      });

      if (adminLoginMessage) {
        adminLoginMessage.textContent = result.message;
      }

      showAdminPanel();
      renderCalendar();
      await loadAdminEvents();
      await loadRegistrations();
      adminLoginForm.reset();
    } catch (error) {
      if (adminLoginMessage) {
        adminLoginMessage.textContent = error.message;
      }
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      const result = await fetchJson('/api/admin/logout', { method: 'POST' });
      if (result.success) {
        showLoginPanel();
      }
    } catch (error) {
      console.error(error);
    }
  });
}

if (eventsList || registrationForm || adminLoginForm) {
  loadEvents();
}

if (adminLoginForm || adminPanel) {
  checkAdminSession();
}
