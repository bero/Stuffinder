import { useState, useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { searchItems, getItems } from '../lib/api';
import { getPhotoUrl } from '../lib/supabase';
import type { ItemWithDetails } from '../types/database';

function SearchIcon() {
  return (
    <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ItemCard({ item }: { item: ItemWithDetails }) {
  const photoUrl = getPhotoUrl(item.photo_path);
  
  return (
    <button
      onClick={() => route(`/item/${item.id}`)}
      class="card flex gap-4 w-full text-left hover:bg-slate-750 active:bg-slate-700 transition-colors"
    >
      {/* Photo thumbnail */}
      <div class="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-700">
        {photoUrl ? (
          <img 
            src={photoUrl} 
            alt={item.name}
            class="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div class="w-full h-full flex items-center justify-center text-3xl">
            {item.category_icon || '📦'}
          </div>
        )}
      </div>
      
      {/* Item info */}
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-slate-100 truncate">{item.name}</h3>
        
        {item.location_full_path && (
          <p class="text-sm text-slate-400 mt-1 flex items-center gap-1">
            <span>📍</span>
            <span class="truncate">{item.location_full_path}</span>
          </p>
        )}
        
        {item.category_name && (
          <span 
            class="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: `${item.category_color}20`, color: item.category_color || '#9ca3af' }}
          >
            <span>{item.category_icon}</span>
            {item.category_name}
          </span>
        )}
      </div>
    </button>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div class="text-center py-12">
      <div class="text-6xl mb-4">{hasSearch ? '🔍' : '📦'}</div>
      <h2 class="text-xl font-semibold text-slate-300">
        {hasSearch ? 'No items found' : 'No items yet'}
      </h2>
      <p class="text-slate-400 mt-2">
        {hasSearch 
          ? 'Try a different search term'
          : 'Tap the + button to add your first item'
        }
      </p>
    </div>
  );
}

export function Home() {
  const [items, setItems] = useState<ItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Load items
  useEffect(() => {
    loadItems();
  }, []);
  
  async function loadItems() {
    try {
      setLoading(true);
      setError(null);
      const data = await getItems();
      setItems(data);
    } catch (err) {
      setError('Failed to load items');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  
  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim()) {
        try {
          const results = await searchItems(searchQuery);
          setItems(results);
        } catch (err) {
          console.error('Search error:', err);
        }
      } else {
        loadItems();
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  return (
    <div class="px-4 pt-6">
      {/* Header */}
      <header class="mb-6">
        <h1 class="text-2xl font-bold text-slate-100">StuffFinder</h1>
        <p class="text-slate-400">Find where you put things</p>
      </header>
      
      {/* Search bar */}
      <div class="relative mb-6">
        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <SearchIcon />
        </div>
        <input
          type="search"
          placeholder="Search items..."
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          class="input pl-12"
        />
      </div>
      
      {/* Error message */}
      {error && (
        <div class="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={loadItems} class="ml-2 underline">Retry</button>
        </div>
      )}
      
      {/* Loading state */}
      {loading ? (
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
        </div>
      ) : items.length === 0 ? (
        <EmptyState hasSearch={searchQuery.trim().length > 0} />
      ) : (
        /* Items list */
        <div class="space-y-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
