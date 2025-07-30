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
  type: String;
};
