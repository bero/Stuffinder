import { useState, useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import {
  queryItems,
  countItems,
  getCategories,
  getLocationsWithPath,
  getTags,
  ITEMS_PAGE_SIZE,
} from '../lib/api';
import { prefetchPhotoUrls } from '../lib/supabase';
import { useT } from '../lib/i18n';
import { LanguagePicker } from '../components/LanguagePicker';
import type { ItemWithDetails, Category, Location, Tag } from '../types/database';

function SearchIcon() {
  return (
    <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ItemCard({ item, photoUrl }: { item: ItemWithDetails; photoUrl: string | null }) {
  return (
    <button
      onClick={() => route(`/item/${item.id}`)}
      class="card flex gap-4 w-full text-left hover:bg-slate-750 active:bg-slate-700 transition-colors"
    >
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
  const t = useT();
  return (
    <div class="text-center py-12">
      <div class="text-6xl mb-4">{hasSearch ? '🔍' : '📦'}</div>
      <h2 class="text-xl font-semibold text-slate-300">
        {hasSearch ? t('home.noItemsFound') : t('home.noItemsYet')}
      </h2>
      <p class="text-slate-400 mt-2">
        {hasSearch
          ? t('home.tryDifferentSearch')
          : t('home.addFirstHint')
        }
      </p>
    </div>
  );
}

interface Props {
  activeHouseholdId?: string;
}

export function Home({ activeHouseholdId }: Props) {
  const t = useT();
  const [items, setItems] = useState<ItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Array<Location & { full_path: string }>>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  const hasActiveFilter =
    searchQuery.trim().length > 0 || !!categoryId || !!locationId || selectedTagIds.size > 0;

  // Collect a location and everything under it (BFS over parent_id).
  function locationWithDescendants(rootId: string): string[] {
    const ids: string[] = [rootId];
    const queue: string[] = [rootId];
    while (queue.length > 0) {
      const parent = queue.shift()!;
      for (const loc of locations) {
        if (loc.parent_id === parent) {
          ids.push(loc.id);
          queue.push(loc.id);
        }
      }
    }
    return ids;
  }

  async function runQuery(silentSpinner = false) {
    if (!activeHouseholdId) return;
    try {
      if (!silentSpinner) setLoading(true);
      setError(null);
      const [data, total] = await Promise.all([
        queryItems(activeHouseholdId, {
          query: searchQuery,
          categoryId: categoryId || undefined,
          locationIds: locationId ? locationWithDescendants(locationId) : undefined,
          tagIds: selectedTagIds.size > 0 ? Array.from(selectedTagIds) : undefined,
        }),
        hasActiveFilter ? Promise.resolve(null as number | null) : countItems(activeHouseholdId),
      ]);
      setItems(data);
      if (total !== null) setTotalCount(total);
    } catch (err) {
      setError(t('home.failedLoad'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Load filter lookup data once per active household.
  useEffect(() => {
    if (!activeHouseholdId) return;
    (async () => {
      try {
        const [cats, locs, tagList] = await Promise.all([
          getCategories(activeHouseholdId),
          getLocationsWithPath(activeHouseholdId),
          getTags(activeHouseholdId),
        ]);
        setCategories(cats);
        setLocations(locs);
        setTags(tagList);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    })();
  }, [activeHouseholdId]);

  // Initial load when household changes.
  useEffect(() => {
    runQuery();
  }, [activeHouseholdId]);

  // Run the query whenever search text or filters change. Debounced so typing
  // isn't overly chatty; chip taps still feel instant because the debounce
  // just defers the request by 300 ms, it doesn't block the UI.
  useEffect(() => {
    if (!activeHouseholdId) return;
    const timer = setTimeout(() => { runQuery(true); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, categoryId, locationId, selectedTagIds, activeHouseholdId]);

  // Batch-sign photo URLs whenever the visible items change.
  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) {
      setPhotoUrls(new Map());
      return;
    }
    const paths = items.map((i) => i.photo_path).filter((p): p is string => !!p);
    prefetchPhotoUrls(paths).then((map) => {
      if (!cancelled) setPhotoUrls(map);
    });
    return () => { cancelled = true; };
  }, [items]);

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function clearAllFilters() {
    setSearchQuery('');
    setCategoryId('');
    setLocationId('');
    setSelectedTagIds(new Set());
  }

  const isTruncated =
    !hasActiveFilter &&
    totalCount !== null &&
    totalCount > ITEMS_PAGE_SIZE &&
    items.length >= ITEMS_PAGE_SIZE;

  return (
    <div class="px-4 pt-6">
      <LanguagePicker />
      <header class="mb-6">
        <h1 class="text-2xl font-bold text-slate-100">{t('home.title')}</h1>
        <p class="text-slate-400">{t('home.tagline')}</p>
      </header>

      <div class="relative mb-3">
        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <SearchIcon />
        </div>
        <input
          type="search"
          placeholder={t('home.searchPlaceholder')}
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          class="input pl-12"
        />
      </div>

      {/* Filters */}
      <div class="mb-4 space-y-2">
        <div class="flex gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId((e.target as HTMLSelectElement).value)}
            class="select flex-1 text-sm py-2"
          >
            <option value="">{t('home.allCategories')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
          <select
            value={locationId}
            onChange={(e) => setLocationId((e.target as HTMLSelectElement).value)}
            class="select flex-1 text-sm py-2"
          >
            <option value="">{t('home.allLocations')}</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.icon} {loc.full_path}
              </option>
            ))}
          </select>
        </div>

        {tags.length > 0 && (
          <div class="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const selected = selectedTagIds.has(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  class={`rounded-full px-2.5 py-0.5 text-xs border transition-colors ${
                    selected
                      ? 'bg-primary-700 border-primary-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}

        {hasActiveFilter && (
          <button
            onClick={clearAllFilters}
            class="text-xs text-slate-400 hover:text-slate-200 underline"
          >
            {t('home.clearFilters')}
          </button>
        )}
      </div>

      {error && (
        <div class="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => runQuery()} class="ml-2 underline">{t('common.retry')}</button>
        </div>
      )}

      {loading ? (
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
        </div>
      ) : items.length === 0 ? (
        <EmptyState hasSearch={hasActiveFilter} />
      ) : (
        <>
          <div class="space-y-3">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                photoUrl={item.photo_path ? photoUrls.get(item.photo_path) ?? null : null}
              />
            ))}
          </div>
          {isTruncated && (
            <p class="text-center text-sm text-slate-500 py-6">
              {t('home.showingRecent', { count: ITEMS_PAGE_SIZE, total: totalCount! })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
