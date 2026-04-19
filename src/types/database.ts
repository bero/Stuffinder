// TypeScript types matching the Supabase database schema.

export interface Household {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface HouseholdMembership {
  household_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  household: Household;
}

export interface HouseholdInvite {
  code: string;
  household_id: string;
  created_by: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Location {
  id: string;
  household_id: string;
  name: string;
  parent_id: string | null;
  icon: string;
  sort_order: number;
  created_at: string;
}

export interface LocationWithPath extends Location {
  full_path: string;
}

export interface Item {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  location_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemPhoto {
  id: string;
  item_id: string;
  household_id: string;
  path: string;
  sort_order: number;
  created_at: string;
}

export interface Tag {
  id: string;
  household_id: string;
  name: string;
  created_at: string;
}

// Embedded in ItemWithDetails.tags (via the jsonb aggregate).
export interface TagRef {
  id: string;
  name: string;
}

export interface ItemWithDetails {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  location_id: string | null;
  location_name: string | null;
  location_full_path: string | null;
  tags: TagRef[];
}

export interface ItemFormData {
  name: string;
  description?: string;
  category_id?: string;
  location_id?: string;
}

export interface CategoryFormData {
  name: string;
  icon?: string;
  color?: string;
}

export interface LocationFormData {
  name: string;
  parent_id?: string;
  icon?: string;
}
