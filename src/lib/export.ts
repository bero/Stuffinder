import { getAllItems, getCategories, getLocations } from './api';
import { prefetchPhotoUrls } from './supabase';
import { rowsToCsv, downloadBlob } from './csv';

export type ExportPhase = 'loading' | 'photos' | 'zipping';

export interface ExportProgress {
  phase: ExportPhase;
  current: number;
  total: number;
}

const CONCURRENCY = 5;

// Produce a self-contained zip: items.csv + photos/ directory.
// Every row's PhotoFile column matches the file path inside the zip.
export async function exportHouseholdZip(
  householdId: string,
  householdName: string,
  onProgress?: (p: ExportProgress) => void,
): Promise<void> {
  onProgress?.({ phase: 'loading', current: 0, total: 1 });
  // Lazy-load JSZip so the 100KB dependency doesn't hit the main bundle.
  const [{ default: JSZip }, items, categories, locations] = await Promise.all([
    import('jszip'),
    getAllItems(householdId),
    getCategories(householdId),
    getLocations(householdId),
  ]);
  onProgress?.({ phase: 'loading', current: 1, total: 1 });

  const zip = new JSZip();

  // Build CSV referencing local file paths inside the zip.
  const csv = rowsToCsv(
    ['Name', 'Description', 'Category', 'Location', 'Added', 'Updated', 'PhotoFile'],
    items.map((i) => {
      const photoFile = i.photo_path ? `photos/${i.photo_path.split('/').pop()}` : '';
      return [
        i.name,
        i.description || '',
        i.category_name || '',
        i.location_full_path || '',
        new Date(i.created_at).toISOString(),
        new Date(i.updated_at).toISOString(),
        photoFile,
      ];
    }),
  );
  zip.file('items.csv', '\uFEFF' + csv);

  // Full-fidelity JSON dumps — use these to restore into another project.
  // Items JSON rewrites photo_path to the filename inside the zip so the archive is self-contained.
  const itemsJson = items.map((i) => ({
    ...i,
    photo_path: i.photo_path ? `photos/${i.photo_path.split('/').pop()}` : null,
  }));
  zip.file('items.json', JSON.stringify(itemsJson, null, 2));
  zip.file('categories.json', JSON.stringify(categories, null, 2));
  zip.file('locations.json', JSON.stringify(locations, null, 2));
  zip.file(
    'export-meta.json',
    JSON.stringify(
      {
        household_id: householdId,
        household_name: householdName,
        exported_at: new Date().toISOString(),
        version: 1,
        counts: {
          items: items.length,
          categories: categories.length,
          locations: locations.length,
        },
      },
      null,
      2,
    ),
  );

  const withPhotos = items.filter((i) => !!i.photo_path);
  onProgress?.({ phase: 'photos', current: 0, total: withPhotos.length });

  if (withPhotos.length > 0) {
    // Batch-sign all URLs up front.
    const urlMap = await prefetchPhotoUrls(withPhotos.map((i) => i.photo_path!));

    // Parallel downloads, bounded concurrency.
    const queue = withPhotos.slice();
    let done = 0;

    async function worker() {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item || !item.photo_path) continue;
        const url = urlMap.get(item.photo_path);
        if (url) {
          try {
            const resp = await fetch(url);
            if (resp.ok) {
              const blob = await resp.blob();
              const filename = item.photo_path.split('/').pop() || 'unknown.jpg';
              zip.file(`photos/${filename}`, blob);
            } else {
              console.warn('Photo fetch failed', item.photo_path, resp.status);
            }
          } catch (err) {
            console.warn('Photo fetch error', item.photo_path, err);
          }
        }
        done++;
        onProgress?.({ phase: 'photos', current: done, total: withPhotos.length });
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
