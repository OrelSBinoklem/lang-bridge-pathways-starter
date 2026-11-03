export type ApiUser = {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  preferred_learn_lang?: string | null;
  roles?: string[];
  is_admin?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AuthResponse = {
  user: ApiUser;
  token: string;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  published: boolean;
  category_id: number;
  category?: Category;
  image_url: string | null;
  updated_at: string | null;
};

export type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  body?: string;
  status: string;
  published_at: string | null;
  author?: { id: number; name: string };
  cover_url: string | null;
};

export type DemoDashboard = {
  user: ApiUser | null;
  stats: {
    users: number;
    categories: number;
    products: number;
    published_products: number;
    posts: number;
    published_posts: number;
  };
  latest_products: Product[];
  latest_posts: Post[];
  queue: {
    connection: string;
    pending_jobs: number;
    failed_jobs: number;
    last_result: {
      requested_by: string;
      message: string;
      processed_at: string;
    } | null;
  };
};

export type Paginated<T> = {
  data: T[];
  meta?: {
    current_page: number;
    last_page: number;
    total: number;
  };
  links?: Record<string, string | null>;
};
