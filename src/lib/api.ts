import { supabase } from './supabase';
import { uploadPhoto, deletePhoto } from './storage';
import type {
  Category,
  Location,
  Item,
  ItemPhoto,
  ItemWithDetails,
  ItemFormData,
  CategoryFormData,
  LocationFormData,
  HouseholdInvite,
  Tag,
} from '../types/database';

// ============ Households ============

export async function createHousehold(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_household', { h_name: name });
  if (error) throw error;
  return data as string;
}

export async function acceptInvite(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invite', { invite_code: code });
  if (error) throw error;
  return data as string;
}

export async function createInvite(householdId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_invite', { h_id: householdId });
  if (error) throw error;
  return data as string;
}

export async function getInvites(householdId: string): Promise<HouseholdInvite[]> {
  const { data, error } = await supabase
    .from('household_invites')
    .select('*')
    .eq('household_id', householdId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function revokeInvite(code: string): Promise<void> {
  const { error } = await supabase.from('household_invites').delete().eq('code', code);
  if (error) throw error;
}

export async function leaveHousehold(householdId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ============ Items ============

export const ITEMS_PAGE_SIZE = 100;

export async function getItems(householdId: string, limit = ITEMS_PAGE_SIZE): Promise<ItemWithDetails[]> {
  const { data, error } = await supabase
    .from('items_with_details')
    .select('*')
    .eq('household_id', householdId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Fetch every item in a household, paginating in 1000-row chunks to bypass
// PostgREST's default max-rows cap. Use for export, not the normal UI.
export async function getAllItems(householdId: string): Promise<ItemWithDetails[]> {
  const CHUNK = 1000;
  const all: ItemWithDetails[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('items_with_details')
      .select('*')
      .eq('household_id', householdId)
      .order('updated_at', { ascending: false })
      .range(from, from + CHUNK - 1);
    if (error) throw error;
    const batch = data || [];
    all.push(...batch);
    if (batch.length < CHUNK) break;
    from += CHUNK;
  }
  return all;
}

export async function countItems(householdId: string): Promise<number> {
  const { count, error } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId);

  if (error) throw error;
  return count || 0;
}

export async function searchItems(householdId: string, query: string, limit = ITEMS_PAGE_SIZE): Promise<ItemWithDetails[]> {
  if (!query.trim()) return getItems(householdId, limit);
  // LIMIT is applied server-side via the RPC's returned SETOF; RLS already
  // scopes rows to households the user is a member of. The multi-household
  // case (rare) still gets a defensive client-side filter.
  const { data, error } = await supabase
    .rpc('search_items', { search_query: query })
    .limit(limit);
  if (error) throw error;
  return (data || []).filter((row: ItemWithDetails) => row.household_id === householdId);
}

export interface ItemFilters {
  query?: string;
  categoryId?: string;
  /** Match items whose location is any of these ids. Caller is expected to pass
   *  the chosen location plus its descendants so "Kitchen" finds things in
   *  "Kitchen > Shelf" too. */
  locationIds?: string[];
  tagIds?: string[];
}

// Unified list/search with filters. Tag filter is AND across tagIds.
export async function queryItems(
  householdId: string,
  filters: ItemFilters,
  limit = ITEMS_PAGE_SIZE,
): Promise<ItemWithDetails[]> {
  const { query, categoryId, locationIds, tagIds } = filters;

  // Pre-resolve items matching ALL supplied tags.
  let tagMatchedIds: string[] | null = null;
  if (tagIds && tagIds.length > 0) {
    const { data, error } = await supabase
      .from('item_tags')
      .select('item_id, tag_id')
      .in('tag_id', tagIds);
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const row of data || []) {
      counts.set(row.item_id, (counts.get(row.item_id) || 0) + 1);
    }
    tagMatchedIds = Array.from(counts.entries())
      .filter(([, n]) => n === tagIds.length)
      .map(([id]) => id);
    if (tagMatchedIds.length === 0) return [];
  }

  const hasQuery = query && query.trim();

  let q = hasQuery
    ? (supabase.rpc('search_items', { search_query: query!.trim() }) as any)
    : (supabase
        .from('items_with_details')
        .select('*')
        .order('updated_at', { ascending: false }) as any);

  q = q.eq('household_id', householdId);
  if (categoryId) q = q.eq('category_id', categoryId);
  if (locationIds && locationIds.length > 0) q = q.in('location_id', locationIds);
  if (tagMatchedIds) q = q.in('id', tagMatchedIds);
  q = q.limit(limit);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []).filter((r: ItemWithDetails) => r.household_id === householdId);
}

export async function getItem(id: string): Promise<ItemWithDetails | null> {
  const { data, error } = await supabase
    .from('items_with_details')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function createItem(householdId: string, formData: ItemFormData): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({
      household_id: householdId,
      name: formData.name,
      description: formData.description || null,
      category_id: formData.category_id || null,
      location_id: formData.location_id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateItem(
  id: string,
  formData: Partial<ItemFormData>,
): Promise<Item> {
  const updateData: Partial<Item> = {};
  if (formData.name !== undefined) updateData.name = formData.name;
  if (formData.description !== undefined) updateData.description = formData.description || null;
  if (formData.category_id !== undefined) updateData.category_id = formData.category_id || null;
  if (formData.location_id !== undefined) updateData.location_id = formData.location_id || null;

  const { data, error } = await supabase
    .from('items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteItem(id: string): Promise<void> {
  // Item's photos are cascade-deleted at the DB level. We still need to
  // remove the files themselves from storage.
  const photos = await getItemPhotos(id);
  if (photos.length > 0) {
    await Promise.all(photos.map((p) => deletePhoto(p.path)));
  }
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
}

// ============ Item photos ============

export async function getItemPhotos(itemId: string): Promise<ItemPhoto[]> {
  const { data, error } = await supabase
    .from('item_photos')
    .select('*')
    .eq('item_id', itemId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addItemPhoto(
  itemId: string,
  householdId: string,
  file: File,
  sortOrder: number,
): Promise<ItemPhoto> {
  const upload = await uploadPhoto(file, householdId);
  if (!upload.success || !upload.path) {
    throw new Error(`Photo upload failed: ${upload.error}`);
  }
  const { data, error } = await supabase
    .from('item_photos')
    .insert({
      item_id: itemId,
      household_id: householdId,
      path: upload.path,
      sort_order: sortOrder,
    })
    .select()
    .single();
  if (error) {
    await deletePhoto(upload.path);
    throw error;
  }
  return data;
}

export async function deleteItemPhoto(photoId: string, path: string): Promise<void> {
  const { error } = await supabase.from('item_photos').delete().eq('id', photoId);
  if (error) throw error;
  await deletePhoto(path);
}

export async function reorderItemPhotos(photoIds: string[]): Promise<void> {
  // One UPDATE per row — small arrays, so not worth batching as an RPC.
  await Promise.all(
    photoIds.map((id, index) =>
      supabase.from('item_photos').update({ sort_order: index }).eq('id', id),
    ),
  );
}

// ============ Tags ============

export async function getTags(householdId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('household_id', householdId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createTag(householdId: string, name: string): Promise<Tag> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tag name required');
  const { data, error } = await supabase
    .from('tags')
    .insert({ household_id: householdId, name: trimmed })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTag(id: string, name: string): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) throw error;
}

// Count of items currently using a given tag.
export async function countItemsWithTag(tagId: string): Promise<number> {
  const { count, error } = await supabase
    .from('item_tags')
    .select('*', { count: 'exact', head: true })
    .eq('tag_id', tagId);
  if (error) throw error;
  return count || 0;
}

// Replace the full set of tags for an item. Deletes rows that aren't in
// the supplied list and inserts the missing ones.
export async function setItemTags(itemId: string, tagIds: string[]): Promise<void> {
  // Remove everything, then insert desired set. Simple and idempotent.
  const { error: delErr } = await supabase.from('item_tags').delete().eq('item_id', itemId);
  if (delErr) throw delErr;
  if (tagIds.length === 0) return;
  const rows = tagIds.map((tag_id) => ({ item_id: itemId, tag_id }));
  const { error: insErr } = await supabase.from('item_tags').insert(rows);
  if (insErr) throw insErr;
}

// ============ Categories ============

export async function getCategories(householdId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createCategory(householdId: string, formData: CategoryFormData): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      household_id: householdId,
      name: formData.name,
      icon: formData.icon || '📦',
      color: formData.color || '#6B7280',
      sort_order: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, formData: Partial<CategoryFormData>): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(formData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getItemsByCategory(householdId: string, categoryId: string): Promise<ItemWithDetails[]> {
  const { data, error } = await supabase
    .from('items_with_details')
    .select('*')
    .eq('household_id', householdId)
    .eq('category_id', categoryId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function reassignItemsCategory(
  householdId: string,
  oldCategoryId: string,
  newCategoryId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ category_id: newCategoryId })
    .eq('household_id', householdId)
    .eq('category_id', oldCategoryId);
  if (error) throw error;
}

// ============ Locations ============

export async function getLocations(householdId: string): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getLocationsWithPath(householdId: string): Promise<Array<Location & { full_path: string }>> {
  const locations = await getLocations(householdId);
  const locationMap = new Map(locations.map(l => [l.id, l]));

  function getPath(loc: Location): string {
    const parts: string[] = [loc.name];
    let current = loc;

    while (current.parent_id) {
      const parent = locationMap.get(current.parent_id);
      if (!parent) break;
      parts.unshift(parent.name);
      current = parent;
    }

    return parts.join(' > ');
  }

  return locations.map(loc => ({
    ...loc,
    full_path: getPath(loc),
  }));
}

export async function createLocation(householdId: string, formData: LocationFormData): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .insert({
      household_id: householdId,
      name: formData.name,
      parent_id: formData.parent_id || null,
      icon: formData.icon || '📍',
      sort_order: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLocation(id: string, formData: Partial<LocationFormData>): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .update(formData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLocation(id: string): Promise<void> {
  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getItemsByLocation(householdId: string, locationId: string): Promise<ItemWithDetails[]> {
  const { data, error } = await supabase
    .from('items_with_details')
    .select('*')
    .eq('household_id', householdId)
    .eq('location_id', locationId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function reassignItemsLocation(
  householdId: string,
  oldLocationId: string,
  newLocationId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ location_id: newLocationId })
    .eq('household_id', householdId)
    .eq('location_id', oldLocationId);
  if (error) throw error;
}
