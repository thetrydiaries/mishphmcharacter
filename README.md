# Mishphm Characters

An internal tool for Confetti Characters — a wedding favour business. Used to build and export custom character illustrations using layered PNG assets.

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** Supabase (PostgreSQL)
- **Canvas:** Konva.js

## Project Structure

```
mishphmcharacter/
├── client/        # React frontend (Vite)
├── server/        # Express backend
├── assets/        # PNG asset layers
│   ├── hair/
│   ├── face/
│   ├── eyes/
│   ├── brows/
│   ├── nose/
│   ├── mouth/
│   ├── facialhair/
│   ├── body/
│   ├── outfit/
│   ├── accessories/
│   └── frames/
└── README.md
```

## Getting Started

### Frontend
```bash
cd client
npm install
npm run dev
```
Runs on http://localhost:5174

### Backend
```bash
cd server
cp .env.example .env   # fill in your Supabase credentials
npm install
npm start
```
Runs on http://localhost:3001

### Health check
```
GET http://localhost:3001/health
→ { "status": "ok" }
```

## Environment Variables

Copy `server/.env.example` to `server/.env` and fill in:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```
