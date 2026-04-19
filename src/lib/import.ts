import { supabase } from './supabase';
import { getCategories, getLocations, getAllItems } from './api';

export type ImportMode = 'replace' | 'merge';

export type ImportPhase =
  | 'reading'
  | 'clearing'
  | 'categories'
  | 'locations'
  | 'photos'
  | 'items'
  | 'done';

export interface ImportProgress {
  phase: ImportPhase;
  current: number;
  total: number;
}

export interface ImportResult {
  items: number;
  categories: number;
  locations: number;
  photos: number;
  photosFailed: number;
  // For merge mode: how many existing items were updated vs newly inserted.
  itemsUpdated?: number;
  itemsInserted?: number;
}

interface ExportMeta {
  version?: number;
  household_id?: string;
  household_name?: string;
}

const SUPPORTED_VERSIONS = [1, 2];

interface ExportCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  created_at?: string;
}

interface ExportLocation {
  id: string;
  name: string;
  parent_id: string | null;
  icon: string;
  sort_order: number;
  created_at?: string;
}

interface ExportItem {
  id: string;
  name: string;
  description: string | null;
  // v1 exports have a single photo_path; v2+ exports have photos: string[].
  photo_path?: string | null;
  photos?: string[];
  category_id: string | null;
  location_id: string | null;
  created_at?: string;
}

// Import a Stuffinder backup zip.
//
// mode === 'replace'
//   Destructive. Deletes all existing items, locations, categories, and photos
//   before loading the backup.
//
// mode === 'merge'
//   Non-destructive. Existing categories and locations are reused (matched by
//   name / hierarchy path); unknown ones are added. For items, match is by
//   description (case-insensitive, trimmed) — when an existing item's
//   description matches a backup item's, its category, location, and photo are
//   updated. Items without a description, or whose description has no match,
//   are inserted as new.
export async function importHouseholdZip(
  householdId: string,
  file: File,
  mode: ImportMode,
  onProgress?: (p: ImportProgress) => void,
): Promise<ImportResult> {
  onProgress?.({ phase: 'reading', current: 0, total: 1 });

  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);

  // --- validate archive ---
  const metaFile = zip.file('export-meta.json');
  if (!metaFile) throw new Error('Not a Stuffinder backup (export-meta.json missing)');
  const meta = JSON.parse(await metaFile.async('string')) as ExportMeta;
  if (!meta.version || !SUPPORTED_VERSIONS.includes(meta.version)) {
    throw new Error(`Unsupported backup version: ${meta.version}`);
  }

  const catFile = zip.file('categories.json');
  const locFile = zip.file('locations.json');
  const itemFile = zip.file('items.json');
  if (!catFile || !locFile || !itemFile) {
    throw new Error('Backup is missing required files');
  }

  const categories = JSON.parse(await catFile.async('string')) as ExportCategory[];
  const locations = JSON.parse(await locFile.async('string')) as ExportLocation[];
  const items = JSON.parse(await itemFile.async('string')) as ExportItem[];

  onProgress?.({ phase: 'reading', current: 1, total: 1 });

  // --- clear existing data (replace mode only) ---
  if (mode === 'replace') {
    onProgress?.({ phase: 'clearing', current: 0, total: 1 });
    {
      const { error } = await supabase.from('items').delete().eq('household_id', householdId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('locations').delete().eq('household_id', householdId);
      if (error) throw error;
    }
    {
      const { error } = await supabase.from('categories').delete().eq('household_id', householdId);
      if (error) throw error;
    }

    const { data: existingFiles } = await supabase.storage.from('photos').list(householdId);
    if (existingFiles && existingFiles.length > 0) {
      const paths = existingFiles.map((f) => `${householdId}/${f.name}`);
      await supabase.storage.from('photos').remove(paths);
    }
    onProgress?.({ phase: 'clearing', current: 1, total: 1 });
  }

  // --- categories: insert in replace mode, match-by-name in merge mode ---
  const categoryIdMap = new Map<string, string>();
  const existingCatsByName = new Map<string, string>();
  if (mode === 'merge') {
    const existing = await getCategories(householdId);
    for (const c of existing) existingCatsByName.set(c.name.toLowerCase(), c.id);
  }

  onProgress?.({ phase: 'categories', current: 0, total: categories.length });
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    const reuseId = mode === 'merge' ? existingCatsByName.get(c.name.toLowerCase()) : undefined;
    if (reuseId) {
      categoryIdMap.set(c.id, reuseId);
    } else {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          household_id: householdId,
          name: c.name,
          icon: c.icon,
          color: c.color,
          sort_order: c.sort_order,
        })
        .select('id')
        .single();
      if (error) throw error;
      categoryIdMap.set(c.id, data.id);
      existingCatsByName.set(c.name.toLowerCase(), data.id);
    }
    onProgress?.({ phase: 'categories', current: i + 1, total: categories.length });
  }

  // --- locations: topological; in merge mode reuse by (parent_id, name) ---
  const locationIdMap = new Map<string, string>();
  const existingLocKeyToId = new Map<string, string>(); // key: `${parent ?? 'root'}:${name_lower}`
  if (mode === 'merge') {
    const existing = await getLocations(householdId);
    for (const l of existing) {
      existingLocKeyToId.set(`${l.parent_id ?? 'root'}:${l.name.toLowerCase()}`, l.id);
    }
  }

  const pending = locations.slice();
  let locProcessed = 0;
  onProgress?.({ phase: 'locations', current: 0, total: locations.length });

  async function placeLocation(loc: ExportLocation, parentOverride: string | null = loc.parent_id) {
    const mappedParent = parentOverride ? locationIdMap.get(parentOverride) ?? null : null;
    const key = `${mappedParent ?? 'root'}:${loc.name.toLowerCase()}`;
    const reuseId = mode === 'merge' ? existingLocKeyToId.get(key) : undefined;
    if (reuseId) {
      locationIdMap.set(loc.id, reuseId);
      return;
    }
    const { data, error } = await supabase
      .from('locations')
      .insert({
        household_id: householdId,
        name: loc.name,
        parent_id: mappedParent,
        icon: loc.icon,
        sort_order: loc.sort_order,
      })
      .select('id')
      .single();
    if (error) throw error;
    locationIdMap.set(loc.id, data.id);
    existingLocKeyToId.set(key, data.id);
  }

  while (pending.length > 0) {
    const before = pending.length;
    for (let i = pending.length - 1; i >= 0; i--) {
      const loc = pending[i];
      if (loc.parent_id === null || locationIdMap.has(loc.parent_id)) {
        await placeLocation(loc);
        pending.splice(i, 1);
        locProcessed++;
        onProgress?.({ phase: 'locations', current: locProcessed, total: locations.length });
      }
    }
    if (pending.length === before) {
      for (const loc of pending) {
        await placeLocation(loc, null);
        locProcessed++;
        onProgress?.({ phase: 'locations', current: locProcessed, total: locations.length });
      }
      break;
    }
  }

  // --- photos: always upload (merge and replace both need new paths) ---
  const photoPathMap = new Map<string, string>();
  const photosFolder = zip.folder('photos');
  const photoFiles: Array<{ name: string; file: any }> = [];
  if (photosFolder) {
    photosFolder.forEach((relativePath, f) => {
      if (!f.dir) photoFiles.push({ name: relativePath, file: f });
    });
  }
  let photosFailed = 0;
  onProgress?.({ phase: 'photos', current: 0, total: photoFiles.length });
  for (let i = 0; i < photoFiles.length; i++) {
    const { name, file } = photoFiles[i];
    const filename = name.split('/').pop() || `photo-${i}.jpg`;
    const newPath = `${householdId}/${filename}`;
    try {
      const blob = await file.async('blob');
      const { error } = await supabase.storage
        .from('photos')
        .upload(newPath, blob, {
          contentType: blob.type || 'image/jpeg',
          upsert: true,
        });
      if (error) throw error;
      photoPathMap.set(`photos/${filename}`, newPath);
    } catch (err) {
      console.warn('Failed to upload photo', name, err);
      photosFailed++;
    }
    onProgress?.({ phase: 'photos', current: i + 1, total: photoFiles.length });
  }

  // --- items: insert in replace mode; match by description in merge mode ---
  let itemsUpdated = 0;
  let itemsInserted = 0;

  const existingByDesc = new Map<string, string>(); // description_lower → existing item id
  if (mode === 'merge') {
    const existing = await getAllItems(householdId);
    for (const i of existing) {
      const desc = (i.description || '').trim().toLowerCase();
      if (desc && !existingByDesc.has(desc)) existingByDesc.set(desc, i.id);
    }
  }

  onProgress?.({ phase: 'items', current: 0, total: items.length });
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const newCategory = it.category_id ? categoryIdMap.get(it.category_id) || null : null;
    const newLocation = it.location_id ? locationIdMap.get(it.location_id) || null : null;

    // Collect this item's photos as remapped storage paths. Handles both v1
    // exports (single photo_path) and v2+ (photos array).
    const rawPhotoRefs = it.photos && it.photos.length > 0
      ? it.photos
      : it.photo_path
        ? [it.photo_path]
        : [];
    const remappedPhotos = rawPhotoRefs
      .map((ref) => photoPathMap.get(ref))
      .filter((p): p is string => !!p);

    const desc = (it.description || '').trim().toLowerCase();
    const matchId = mode === 'merge' && desc ? existingByDesc.get(desc) : undefined;

    let itemId: string;
    if (matchId) {
      const { error } = await supabase
        .from('items')
        .update({
          category_id: newCategory,
          location_id: newLocation,
        })
        .eq('id', matchId);
      if (error) throw error;
      itemId = matchId;
      itemsUpdated++;

      // Merge-mode photo behaviour: replace the existing photo set with
      // whatever the backup says (matches the user's expectation that the
      // backup's image wins for matching descriptions).
      if (remappedPhotos.length > 0) {
        // Remove existing photo rows for this item; storage files stay (best-effort).
        await supabase.from('item_photos').delete().eq('item_id', itemId);
      }
    } else {
      const { data, error } = await supabase
        .from('items')
        .insert({
          household_id: householdId,
          name: it.name,
          description: it.description,
          category_id: newCategory,
          location_id: newLocation,
        })
        .select('id')
        .single();
      if (error) throw error;
      itemId = data.id;
      itemsInserted++;
    }

    // Insert photo rows in order.
    if (remappedPhotos.length > 0) {
      const photoRows = remappedPhotos.map((path, idx) => ({
        item_id: itemId,
        household_id: householdId,
        path,
        sort_order: idx,
      }));
      const { error: photoErr } = await supabase.from('item_photos').insert(photoRows);
      if (photoErr) throw photoErr;
    }

    onProgress?.({ phase: 'items', current: i + 1, total: items.length });
  }

  onProgress?.({ phase: 'done', current: 1, total: 1 });

  return {
    items: items.length,
    categories: categories.length,
    locations: locations.length,
    photos: photoFiles.length - photosFailed,
    photosFailed,
    itemsUpdated,
    itemsInserted,
  };
}
