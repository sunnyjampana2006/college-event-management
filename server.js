const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const port = Number(process.env.PORT) || 3001;
const db = new Database(path.join(__dirname, 'events.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
if (db.prepare('SELECT COUNT(*) AS count FROM events').get().count === 0) {
  const addSample = db.prepare('INSERT INTO events (title,category,event_date,event_time,location,description,capacity) VALUES (?,?,?,?,?,?,?)');
  const samples = [
    ['Build Night: Tiny Web Apps', 'Technology', 3, '17:30', 'Innovation Lab · Room 204', 'Bring a laptop and turn one small idea into a working web page with the coding club.', 40],
    ['Open Mic After Hours', 'Culture', 5, '19:00', 'Student Union · Main Lounge', 'Music, poetry, comedy and whatever else you want to share. Sign-ups are open at the door.', 70],
    ['Make Your First Portfolio', 'Career', 7, '16:00', 'Library · Media Studio', 'A relaxed portfolio workshop with practical tips for showcasing class projects and skills.', 32],
    ['Campus Garden Volunteer Day', 'Community', 10, '10:00', 'North Quad Garden', 'Help plant this season’s campus garden. Gloves and snacks will be provided.', 25]
  ];
  const seed = db.transaction(() => samples.forEach(([title, category, days, time, location, description, capacity]) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const eventDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    addSample.run(title, category, eventDate, time, location, description, capacity);
  }));
  seed();
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const categories = new Set(['Technology', 'Culture', 'Career', 'Sports', 'Workshop', 'Community']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dateIsValid = (date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
const eventsQuery = db.prepare(`SELECT e.*, COUNT(r.id) AS registered_count FROM events e LEFT JOIN registrations r ON r.event_id=e.id GROUP BY e.id ORDER BY e.event_date, e.event_time`);
const eventQuery = db.prepare(`SELECT e.*, COUNT(r.id) AS registered_count FROM events e LEFT JOIN registrations r ON r.event_id=e.id WHERE e.id=? GROUP BY e.id`);
const eventsView = () => eventsQuery.all().map((event) => ({ ...event, spots_left: Math.max(0, event.capacity - event.registered_count) }));
const categoriesList = [...categories];

function validEvent(body) {
  return body && typeof body.title === 'string' && body.title.trim().length >= 3 && body.title.trim().length <= 100 &&
    categories.has(body.category) && dateIsValid(body.event_date) && typeof body.event_time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.event_time) &&
    typeof body.location === 'string' && body.location.trim().length >= 2 && body.location.trim().length <= 120 &&
    typeof body.description === 'string' && body.description.trim().length >= 5 && body.description.trim().length <= 1000 &&
    Number.isInteger(Number(body.capacity)) && Number(body.capacity) >= 1 && Number(body.capacity) <= 10000;
}

app.get('/', (req, res) => res.render('index', { events: eventsView(), categories: categoriesList }));
app.get('/api/events', (req, res) => res.json(eventsView()));
app.get('/api/events/:id', (req, res) => {
  const event = eventQuery.get(Number(req.params.id));
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  res.json({ ...event, spots_left: Math.max(0, event.capacity - event.registered_count) });
});
app.post('/api/events', (req, res) => {
  if (!validEvent(req.body)) return res.status(400).json({ error: 'Check the event details and try again.' });
  const body = req.body;
  const result = db.prepare('INSERT INTO events (title,category,event_date,event_time,location,description,capacity) VALUES (?,?,?,?,?,?,?)')
    .run(body.title.trim(), body.category, body.event_date, body.event_time, body.location.trim(), body.description.trim(), Number(body.capacity));
  res.status(201).json(eventQuery.get(result.lastInsertRowid));
});
app.put('/api/events/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid event.' });
  if (!validEvent(req.body)) return res.status(400).json({ error: 'Check the event details and try again.' });
  const body = req.body;
  const result = db.prepare('UPDATE events SET title=?,category=?,event_date=?,event_time=?,location=?,description=?,capacity=? WHERE id=?')
    .run(body.title.trim(), body.category, body.event_date, body.event_time, body.location.trim(), body.description.trim(), Number(body.capacity), id);
  if (!result.changes) return res.status(404).json({ error: 'Event not found.' });
  res.json(eventQuery.get(id));
});
app.delete('/api/events/:id', (req, res) => {
  const result = db.prepare('DELETE FROM events WHERE id=?').run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Event not found.' });
  res.status(204).end();
});
app.get('/api/events/:id/registrations', (req, res) => {
  if (!eventQuery.get(Number(req.params.id))) return res.status(404).json({ error: 'Event not found.' });
  res.json(db.prepare('SELECT id,student_name,student_email,registered_at FROM registrations WHERE event_id=? ORDER BY registered_at DESC').all(Number(req.params.id)));
});
app.post('/api/events/:id/register', (req, res) => {
  const id = Number(req.params.id);
  const event = eventQuery.get(id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  const name = typeof req.body.student_name === 'string' ? req.body.student_name.trim() : '';
  const email = typeof req.body.student_email === 'string' ? req.body.student_email.trim().toLowerCase() : '';
  if (name.length < 2 || name.length > 100 || !emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid name and email address.' });
  if (event.registered_count >= event.capacity) return res.status(409).json({ error: 'Sorry, this event is full.' });
  try {
    const result = db.prepare('INSERT INTO registrations (event_id,student_name,student_email) VALUES (?,?,?)').run(id, name, email);
    res.status(201).json({ id: result.lastInsertRowid, message: 'You are registered! See you there.' });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'This email is already registered for the event.' });
    throw error;
  }
});
app.use((error, req, res, next) => {
  console.error(error.message);
  res.status(500).json({ error: 'The server could not complete that request.' });
});
app.listen(port, '0.0.0.0', () => console.log(`Campus events is running at http://localhost:${port}`));
