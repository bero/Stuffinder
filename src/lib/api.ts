import { supabase } from './supabase';
import { uploadPhoto, deletePhoto } from './storage';
import type { 
  Category, 
  Location, 
  Item, 
  ItemWithDetails, 
  ItemFormData,
  CategoryFormData,
  LocationFormData 
} from '../types/database';

// ============ Items ============

export async function getItems(): Promise<ItemWithDetails[]> {
  const { data, error } = await supabase
    .from('items_with_details')
    .select('*')
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function searchItems(query: string): Promise<ItemWithDetails[]> {
  const { data, error } = await supabase
    .rpc('search_items', { search_query: query });
  
  if (error) throw error;
  return data || [];
}

export async function getItem(id: string): Promise<ItemWithDetails | null> {
  const { data, error } = await supabase
    .from('items_with_details')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

export async function createItem(formData: ItemFormData): Promise<Item> {
  let photoPath: string | undefined;
  
  // Upload photo if provided
  if (formData.photo) {
    const result = await uploadPhoto(formData.photo);
    if (!result.success) {
      throw new Error(`Photo upload failed: ${result.error}`);
    }
    photoPath = result.path;
  }
  
  const { data, error } = await supabase
    .from('items')
    .insert({
      name: formData.name,
      description: formData.description || null,
      category_id: formData.category_id || null,
      location_id: formData.location_id || null,
      photo_path: photoPath || null,
    })
    .select()
    .single();
  
  if (error) {
    // Clean up uploaded photo if insert failed
    if (photoPath) await deletePhoto(photoPath);
    throw error;
  }
  
  return data;
}

export async function updateItem(id: string, formData: Partial<ItemFormData>, oldPhotoPath?: string | null): Promise<Item> {
  let photoPath: string | undefined;
  
  // Upload new photo if provided
  if (formData.photo) {
    const result = await uploadPhoto(formData.photo);
    if (!result.success) {
      throw new Error(`Photo upload failed: ${result.error}`);
    }
    photoPath = result.path;
    
    // Delete old photo
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
  // Delete photo from storage first
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

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function createCategory(formData: CategoryFormData): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
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

// ============ Locations ============

export async function getLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('sort_order', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

// Get locations with full path (uses recursive CTE in the view)
export async function getLocationsWithPath(): Promise<Array<Location & { full_path: string }>> {
  // For hierarchical display, we build the path client-side
  const locations = await getLocations();
  
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

export async function createLocation(formData: LocationFormData): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .insert({
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
