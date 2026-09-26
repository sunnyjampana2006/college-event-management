# Gather — College Event Management System

A college event browser and registration app built with HTML, CSS, Bootstrap, JavaScript, Node.js, Express, EJS, and SQLite SQL.

## Run it locally

1. Install Node.js 18 or newer.
2. Open a terminal in this folder and run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3001`.

SQLite creates `events.db` automatically. Bootstrap and fonts are loaded from CDNs.

## Features

- Browse and search upcoming campus events, with category filters.
- Publish events with date, time, location, category and attendee capacity.
- Register students by name and email; prevent duplicate registration and full-event signups.
- REST API for listing, viewing, creating, editing, and deleting events, listing registrations, and registering students.

## API

- `GET /api/events` — list events and available spots.
- `GET /api/events/:id` — event details.
- `POST /api/events` — create an event.
- `PUT /api/events/:id` — update an event.
- `DELETE /api/events/:id` — delete an event and its registrations.
- `GET /api/events/:id/registrations` — list event registrants.
- `POST /api/events/:id/register` — register a student (`student_name`, `student_email`).
