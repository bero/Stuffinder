// TypeScript types matching the Supabase database schema
// These provide compile-time type checking for all database operations

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  parent_id: string | null;
  icon: string;
  sort_order: number;
  created_at: string;
}

// Location with computed full path (from recursive query)
export interface LocationWithPath extends Location {
  full_path: string;
}

export interface Item {
  id: string;
  name: string;
  description: string | null;
  photo_path: string | null;
  category_id: string | null;
  location_id: string | null;
  created_at: string;
  updated_at: string;
}

// Item with joined category and location details (from view)
export interface ItemWithDetails {
  id: string;
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
}

// Form data types (for creating/updating)
export interface ItemFormData {
  name: string;
  description?: string;
  category_id?: string;
  location_id?: string;
  photo?: File;
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

// Supabase generated types helper
// You can generate these automatically with: npx supabase gen types typescript
export interface Database {
  public: {
    Tables: {
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Category, 'id' | 'created_at'>>;
      };
      locations: {
        Row: Location;
        Insert: Omit<Location, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Location, 'id' | 'created_at'>>;
      };
      items: {
        Row: Item;
        Insert: Omit<Item, 'id' | 'created_at' | 'updated_at'> & { 
          id?: string; 
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Item, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
    Views: {
      items_with_details: {
        Row: ItemWithDetails;
      };
    };
    Functions: {
      search_items: {
        Args: { search_query: string };
        Returns: ItemWithDetails[];
      };
    };
  };
}

// Utility type for Supabase responses
export type DbResult<T> = T extends PromiseLike<infer U> ? U : never;
export type DbResultOk<T> = T extends PromiseLike<{ data: infer U }> ? Exclude<U, null> : never;
