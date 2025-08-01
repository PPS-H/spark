export type AddContentRequest = {
  title: string;
  genre: string;
  description: string;
};

export type GetContentRequest = { type?: string };

export type LikeDislikeRequest = {
  contentId: string;
};

export type GetTrendingContentRequest = {
  page: number;
  limit: number;
  type: string;
  search: string;
};

export type SearchContentRequest = { search: string };
