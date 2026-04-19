import { supabase } from './supabase';
import { uploadPhoto, deletePhoto } from './storage';
import type {
  Category,
  Location,
  Item,
  ItemWithDetails,
  ItemFormData,
  CategoryFormData,
  LocationFormData,
  HouseholdInvite,
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
  let photoPath: string | undefined;

  if (formData.photo) {
    const result = await uploadPhoto(formData.photo, householdId);
    if (!result.success) {
      throw new Error(`Photo upload failed: ${result.error}`);
    }
    photoPath = result.path;
  }

  const { data, error } = await supabase
    .from('items')
    .insert({
      household_id: householdId,
      name: formData.name,
      description: formData.description || null,
      category_id: formData.category_id || null,
      location_id: formData.location_id || null,
      photo_path: photoPath || null,
    })
    .select()
    .single();

  if (error) {
    if (photoPath) await deletePhoto(photoPath);
    throw error;
  }

  return data;
}

export async function updateItem(
  id: string,
  householdId: string,
  formData: Partial<ItemFormData>,
  oldPhotoPath?: string | null,
): Promise<Item> {
  let photoPath: string | undefined;

  if (formData.photo) {
    const result = await uploadPhoto(formData.photo, householdId);
    if (!result.success) {
      throw new Error(`Photo upload failed: ${result.error}`);
    }
    photoPath = result.path;

    if (oldPhotoPath) {
      await deletePhoto(oldPhotoPath);
    }
  }

  const updateData: Partial<Item> = {};
  if (formData.name !== undefined) updateData.name = formData.name;
  if (formData.description !== undefined) updateData.description = formData.description || null;
  if (formData.category_id !== undefined) updateData.category_id = formData.category_id || null;
  if (formData.location_id !== undefined) updateData.location_id = formData.location_id || null;
  if (photoPath) updateData.photo_path = photoPath;

  const { data, error } = await supabase
    .from('items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteItem(id: string, photoPath?: string | null): Promise<void> {
  if (photoPath) {
    await deletePhoto(photoPath);
  }

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id);

  if (error) throw error;
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
