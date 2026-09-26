const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const rootDir = __dirname;
const registrationFile = path.join(rootDir, 'data', 'registrations.json');
const eventsFile = path.join(rootDir, 'data', 'events.json');
const adminUser = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'temple123'
};
const adminSessions = new Map();

function getCookieOptions(req) {
  const isSecureRequest = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isSecureRequest,
    sameSite: isSecureRequest ? 'None' : 'Lax',
    path: '/'
  };
}

function buildCookieHeader(token, req) {
  const options = getCookieOptions(req);
  const parts = [`${encodeURIComponent('admin_session')}=${encodeURIComponent(token)}`];

  parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  return parts.join('; ');
}

function clearCookieHeader(req) {
  return `admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; ${getCookieOptions(req).secure ? 'Secure; ' : ''}SameSite=${getCookieOptions(req).sameSite}`;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [name, ...rest] = entry.split('=');
        return [name, rest.join('=')];
      })
  );
}

function isAdminSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.admin_session || '';
  if (!token || !adminSessions.has(token)) {
    return false;
  }

  const session = adminSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    adminSessions.delete(token);
    return false;
  }

  return true;
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed || fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readRegistrations() {
  return readJson(registrationFile, []);
}

function saveRegistrations(entries) {
  writeJson(registrationFile, entries);
}

function getEvents() {
  return readJson(eventsFile, []);
}

function saveEvents(events) {
  writeJson(eventsFile, events);
}

function safeJoin(basePath, requestPath) {
  const normalizedPath = requestPath.split('?')[0].replace(/\\+/g, '/');
  const cleanPath = normalizedPath === '/' ? '/index.html' : normalizedPath;
  const resolvedPath = path.normalize(path.join(basePath, cleanPath));

  if (!resolvedPath.startsWith(basePath)) {
    return null;
  }

  return resolvedPath;
}

function serveStaticFile(req, res, urlPath) {
  const filePath = safeJoin(rootDir, urlPath);
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/events') {
    sendJson(res, 200, { success: true, events: getEvents() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/register') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const required = ['fullName', 'email', 'phone', 'event'];
        const missing = required.filter((field) => !payload[field]);

        if (missing.length > 0) {
          sendJson(res, 400, {
            success: false,
            message: `Missing required fields: ${missing.join(', ')}`
          });
          return;
        }

        const registrations = readRegistrations();
        const registration = {
          id: Date.now(),
          createdAt: new Date().toISOString(),
          fullName: payload.fullName,
          email: payload.email,
          phone: payload.phone,
          event: payload.event,
          guests: Number(payload.guests || 1),
          time: payload.time || 'Evening',
          message: payload.message || '',
          status: 'pending'
        };

        registrations.push(registration);
        saveRegistrations(registrations);

        sendJson(res, 200, {
          success: true,
          message: `Registration received for ${payload.event}.`,
          registration
        });
      } catch (error) {
        sendJson(res, 400, {
          success: false,
          message: 'Invalid JSON payload.'
        });
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/registrations') {
    sendJson(res, 200, { success: true, registrations: readRegistrations() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const username = payload.username || '';
        const password = payload.password || '';

        if (username === adminUser.username && password === adminUser.password) {
          const token = crypto.randomBytes(24).toString('hex');
          adminSessions.set(token, {
            expiresAt: Date.now() + 1000 * 60 * 60 * 8
          });

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Set-Cookie': buildCookieHeader(token, req)
          });

          res.end(JSON.stringify({ success: true, message: 'Login successful.' }));
          return;
        }

        sendJson(res, 401, { success: false, message: 'Invalid username or password.' });
      } catch (error) {
        sendJson(res, 400, { success: false, message: 'Invalid login payload.' });
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/events') {
    if (!isAdminSession(req)) {
      sendJson(res, 401, { success: false, message: 'Unauthorized.' });
      return;
    }

    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const title = payload.title || '';
        const date = payload.date || '';
        const description = payload.description || '';

        if (!title || !date || !description) {
          sendJson(res, 400, { success: false, message: 'Title, date, and description are required.' });
          return;
        }

        const events = getEvents();
        const newEvent = {
          id: Date.now(),
          title,
          date,
          description,
          details: payload.details || '',
          image: payload.image || ''
        };

        events.push(newEvent);
        saveEvents(events);

        sendJson(res, 200, { success: true, message: 'Event added successfully.', event: newEvent });
      } catch (error) {
        sendJson(res, 400, { success: false, message: 'Invalid event payload.' });
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies.admin_session || '';

    if (token) {
      adminSessions.delete(token);
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Set-Cookie': clearCookieHeader(req)
    });

    res.end(JSON.stringify({ success: true, message: 'Logged out successfully.' }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/session') {
    sendJson(res, 200, { loggedIn: isAdminSession(req) });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/events') {
    if (!isAdminSession(req)) {
      sendJson(res, 401, { success: false, message: 'Unauthorized.' });
      return;
    }

    sendJson(res, 200, { success: true, events: getEvents() });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/registrations') {
    if (!isAdminSession(req)) {
      sendJson(res, 401, { success: false, message: 'Unauthorized.' });
      return;
    }

    const registrations = readRegistrations().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    sendJson(res, 200, { success: true, registrations });
    return;
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/admin/registrations/')) {
    if (!isAdminSession(req)) {
      sendJson(res, 401, { success: false, message: 'Unauthorized.' });
      return;
    }

    const registrationId = Number(url.pathname.split('/').pop());
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const registrations = readRegistrations();
        const index = registrations.findIndex((entry) => Number(entry.id) === registrationId);

        if (index === -1) {
          sendJson(res, 404, { success: false, message: 'Registration not found.' });
          return;
        }

        const validStatuses = ['pending', 'approved', 'rejected'];
        const nextStatus = (payload.status || registrations[index].status || 'pending').toLowerCase();

        if (!validStatuses.includes(nextStatus)) {
          sendJson(res, 400, { success: false, message: 'Invalid status.' });
          return;
        }

        registrations[index].status = nextStatus;
        saveRegistrations(registrations);
        sendJson(res, 200, { success: true, message: `Registration ${nextStatus}.`, registration: registrations[index] });
      } catch (error) {
        sendJson(res, 400, { success: false, message: 'Invalid registration payload.' });
      }
    });
    return;
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/events/')) {
    if (!isAdminSession(req)) {
      sendJson(res, 401, { success: false, message: 'Unauthorized.' });
      return;
    }

    const eventId = Number(url.pathname.split('/').pop());
    const events = getEvents();
    const index = events.findIndex((event) => Number(event.id) === eventId);

    if (index === -1) {
      sendJson(res, 404, { success: false, message: 'Event not found.' });
      return;
    }

    events.splice(index, 1);
    saveEvents(events);
    sendJson(res, 200, { success: true, message: 'Event deleted.' });
    return;
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/admin/events/')) {
    if (!isAdminSession(req)) {
      sendJson(res, 401, { success: false, message: 'Unauthorized.' });
      return;
    }

    const eventId = Number(url.pathname.split('/').pop());
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const events = getEvents();
        const index = events.findIndex((event) => Number(event.id) === eventId);

        if (index === -1) {
          sendJson(res, 404, { success: false, message: 'Event not found.' });
          return;
        }

        events[index] = {
          ...events[index],
          title: payload.title || events[index].title,
          date: payload.date || events[index].date,
          description: payload.description || events[index].description,
          details: payload.details || events[index].details || '',
          image: payload.image !== undefined ? payload.image : (events[index].image || '')
        };

        saveEvents(events);
        sendJson(res, 200, { success: true, message: 'Event updated.' });
      } catch (error) {
        sendJson(res, 400, { success: false, message: 'Invalid event payload.' });
      }
    });
    return;
  }

  serveStaticFile(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Temple website running at http://localhost:${PORT}`);
});
