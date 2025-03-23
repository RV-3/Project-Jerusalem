# Project Jerusalem — Calendar Reservation App

This is a full-stack calendar reservation system built with **React**, **FullCalendar**, and **Sanity.io**. Users can reserve hourly time slots, and an admin panel allows blocking specific days.

---

## 🔧 Features

- 📅 Weekly calendar with hourly slots
- 🙋‍♂️ Form-based slot reservation with name and phone number
- 🔐 Prevents double-booking and past-time selection
- 🔒 Admin panel to block/unblock dates
- ☁️ Sanity CMS backend to store reservations and blocked days

---

## 📁 Folder Structure

```bash
calendar-reservation-app/
├── frontend/        # React app (calendar UI + admin panel)
├── backend/         # Sanity project


🚀 Getting Started
1. Clone the Repository
```git clone https://github.com/RV-3/Project-Jerusalem.git
cd Project-Jerusalem ```
⚙️ FRONTEND SETUP
```cd frontend```
```npm install```
```npm start```
Opens the calendar at: http://localhost:3000/

Admin panel at: http://localhost:3000/admin

🔒 Make sure your .env or Calendar.js has your correct Sanity token if needed.

🔙 BACKEND SETUP (SANITY)
If you're starting fresh:

```cd backend/project-jerusalem```
```npm install```
```npm run dev```
This starts Sanity Studio at: http://localhost:3333/

From here, you can:

Manage reservations

View and edit blocked dates

🧪 Data Models
You should have two schema types:

reservation
{
  name: 'reservation',
  type: 'document',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'phone', type: 'string' },
    { name: 'start', type: 'datetime' },
    { name: 'end', type: 'datetime' },
  ]
}
blocked

{
  name: 'blocked',
  type: 'document',
  fields: [
    { name: 'date', type: 'date' }
  ]
}
✅ Requirements
Node.js v18+

npm v9+

Internet connection to access Sanity's API

🛠 Tips
Push updates to GitHub using:

git add .
git commit -m "Update"
git push origin main
You can edit the frontend in frontend/src/Calendar.js and AdminBlockCalendar.js


Built by Project Jerusalem
