import { supabase, prefetchPhotoUrls } from './supabase';
import { getAllItems, getCategories, getLocations, getTags } from './api';
import { rowsToCsv, downloadBlob } from './csv';

export type ExportPhase = 'loading' | 'photos' | 'zipping';

export interface ExportProgress {
  phase: ExportPhase;
  current: number;
  total: number;
}

const CONCURRENCY = 5;

// Produce a self-contained zip: items.csv + items.json + categories.json +
// locations.json + photos/ directory. Every photo is referenced by path
// inside the zip so the archive is usable standalone.
export async function exportHouseholdZip(
  householdId: string,
  householdName: string,
  onProgress?: (p: ExportProgress) => void,
): Promise<void> {
  onProgress?.({ phase: 'loading', current: 0, total: 1 });

  // Lazy-load JSZip so the dependency doesn't hit the main bundle.
  const [{ default: JSZip }, items, categories, locations, tagList, photosResult, itemTagsResult] =
    await Promise.all([
      import('jszip'),
      getAllItems(householdId),
      getCategories(householdId),
      getLocations(householdId),
      getTags(householdId),
      supabase.from('item_photos').select('*').eq('household_id', householdId).order('sort_order'),
      supabase
        .from('item_tags')
        .select('item_id, tag_id, tags!inner(household_id)')
        .eq('tags.household_id', householdId),
    ]);

  if (photosResult.error) throw photosResult.error;
  const allPhotos = photosResult.data || [];
  if (itemTagsResult.error) throw itemTagsResult.error;
  const allItemTags = (itemTagsResult.data || []) as Array<{ item_id: string; tag_id: string }>;

  // Group photos by item_id for quick lookup.
  const photosByItem = new Map<string, Array<{ path: string; sort_order: number }>>();
  for (const p of allPhotos) {
    const list = photosByItem.get(p.item_id) || [];
    list.push({ path: p.path, sort_order: p.sort_order });
    photosByItem.set(p.item_id, list);
  }

  // Group tag ids by item_id.
  const tagsByItem = new Map<string, string[]>();
  for (const it of allItemTags) {
    const list = tagsByItem.get(it.item_id) || [];
    list.push(it.tag_id);
    tagsByItem.set(it.item_id, list);
  }

  onProgress?.({ phase: 'loading', current: 1, total: 1 });

  const zip = new JSZip();

  // Map tag id → name for the CSV column.
  const tagNameById = new Map(tagList.map((t) => [t.id, t.name]));

  // CSV: one row per item, PhotoFiles + Tags semicolon-joined.
  const csv = rowsToCsv(
    ['Name', 'Description', 'Category', 'Location', 'Tags', 'Added', 'Updated', 'PhotoFiles'],
    items.map((i) => {
      const itemPhotos = photosByItem.get(i.id) || [];
      const photoRefs = itemPhotos.map((p) => `photos/${p.path.split('/').pop()}`).join('; ');
      const tagIds = tagsByItem.get(i.id) || [];
      const tagNames = tagIds.map((id) => tagNameById.get(id) || '').filter(Boolean).join('; ');
      return [
        i.name,
        i.description || '',
        i.category_name || '',
        i.location_full_path || '',
        tagNames,
        new Date(i.created_at).toISOString(),
        new Date(i.updated_at).toISOString(),
        photoRefs,
      ];
    }),
  );
  zip.file('items.csv', '\uFEFF' + csv);

  // JSON: full fidelity. photos = archive-relative paths; tag_ids = references
  // into tags.json (original IDs; restored via a name-match map on import).
  const itemsJson = items.map((i) => {
    const itemPhotos = photosByItem.get(i.id) || [];
    return {
      ...i,
      photo_path: undefined, // derived view field — don't include in backup
      photos: itemPhotos.map((p) => `photos/${p.path.split('/').pop()}`),
      tag_ids: tagsByItem.get(i.id) || [],
    };
  });
  zip.file('items.json', JSON.stringify(itemsJson, null, 2));
  zip.file('categories.json', JSON.stringify(categories, null, 2));
  zip.file('locations.json', JSON.stringify(locations, null, 2));
  zip.file('tags.json', JSON.stringify(tagList, null, 2));
  zip.file(
    'export-meta.json',
    JSON.stringify(
      {
        household_id: householdId,
        household_name: householdName,
        exported_at: new Date().toISOString(),
        version: 3, // photos array + tags
        counts: {
          items: items.length,
          categories: categories.length,
          locations: locations.length,
          tags: tagList.length,
          photos: allPhotos.length,
        },
      },
      null,
      2,
    ),
  );

  onProgress?.({ phase: 'photos', current: 0, total: allPhotos.length });

  if (allPhotos.length > 0) {
    const urlMap = await prefetchPhotoUrls(allPhotos.map((p) => p.path));

    const queue = allPhotos.slice();
    let done = 0;

    async function worker() {
      while (queue.length > 0) {
        const p = queue.shift();
        if (!p) continue;
        const url = urlMap.get(p.path);
        if (url) {
          try {
            const resp = await fetch(url);
            if (resp.ok) {
              const blob = await resp.blob();
              const filename = p.path.split('/').pop() || 'unknown.jpg';
              zip.file(`photos/${filename}`, blob);
            } else {
              console.warn('Photo fetch failed', p.path, resp.status);
            }
          } catch (err) {
            console.warn('Photo fetch error', p.path, err);
          }
        }
        done++;
        onProgress?.({ phase: 'photos', current: done, total: allPhotos.length });
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  onProgress?.({ phase: 'zipping', current: 0, total: 1 });
  const blob = await zip.generateAsync({ type: 'blob' });
  onProgress?.({ phase: 'zipping', current: 1, total: 1 });

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = (householdName || 'household').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  downloadBlob(`stuffinder-${slug}-${stamp}.zip`, blob);
}
