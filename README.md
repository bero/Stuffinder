# StuffFinder

A simple PWA to catalog and find your belongings. Take a photo, assign a location and category, and never forget where you put things again.

## Tech Stack

- **Frontend**: TypeScript + Vite + Preact
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Storage + Auth)
- **Hosting**: Vercel/Netlify (free tier)

## Features

- 📸 Take photos directly from the app (uses device camera)
- 📍 Organize by location (hierarchical: "Garage" → "Shelf 1")
- 🏷️ Categorize items (Tools, Electronics, Documents, etc.)
- 🔍 Quick search across all items
- 📱 PWA - installable on iOS/Android home screen
- ☁️ Cloud sync via Supabase

## Prerequisites

- Node.js 18+ (https://nodejs.org)
- A Supabase account (free: https://supabase.com)

## Quick Start

1. **Clone and install:**
   ```bash
   cd stuffinder
   npm install
   ```

2. **Set up Supabase:**
   - Create a new project at supabase.com
   - Go to SQL Editor and run the contents of `supabase/schema.sql`
   - Go to Storage and create a bucket called `photos` (make it public)
   - Copy your project URL and anon key from Settings → API

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. **Open in browser:**
   Navigate to `http://localhost:5173`

## Project Structure

```
stuffinder/
├── public/
│   ├── manifest.json      # PWA manifest
│   └── icons/             # App icons
├── src/
│   ├── types/
│   │   └── database.ts    # TypeScript types matching DB schema
│   ├── lib/
│   │   ├── supabase.ts    # Supabase client setup
│   │   └── storage.ts     # Photo upload helpers
│   ├── components/
│   │   ├── Camera.tsx     # Camera capture component
│   │   ├── ItemCard.tsx   # Display single item
│   │   ├── ItemForm.tsx   # Add/edit item form
│   │   └── SearchBar.tsx  # Search input
│   ├── pages/
│   │   ├── Home.tsx       # Main view with search
│   │   ├── AddItem.tsx    # Add new item flow
│   │   └── Settings.tsx   # Manage categories/locations
│   ├── App.tsx            # Main app with routing
│   ├── main.tsx           # Entry point
│   └── index.css          # Tailwind imports
├── supabase/
│   └── schema.sql         # Database schema
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Data Model

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Category   │     │    Item     │     │  Location   │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id          │◄────│ category_id │     │ id          │
│ name        │     │ location_id │────►│ name        │
│ icon        │     │ name        │     │ parent_id   │──┐
│ color       │     │ description │     │ icon        │  │
└─────────────┘     │ photo_path  │     └─────────────┘  │
                    │ created_at  │           ▲          │
                    └─────────────┘           └──────────┘
                                             (self-reference)
```

## Useful Commands

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

## iOS Installation (Add to Home Screen)

1. Open the app in Safari on your iPhone
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

The app will now appear on your home screen and work like a native app!
