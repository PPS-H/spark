export type CreateProjectRequest = {
  title: string;
  fundingGoal: number;
  description: string;
  duration: string;
  songTitle: string;
  artistName: string;
  isrcCode: string;
  upcCode?: string;
  spotifyTrackLink?: string;
  spotifyTrackId?: string;
  youtubeMusicLink?: string;
  youtubeVideoId?: string;
  deezerTrackLink?: string;
  deezerTrackId?: string;
  releaseType: 'single' | 'album' | 'ep';
  expectedReleaseDate?: string;
  fundingDeadline?: string;
  distrokidFile?: File;
  projectImage?: File;
  invoiceFile?: File;
  milestones: Array<{
    name: string;
    amount: number;
    description: string;
    order: number;
  }>;
};

export type UpdateProjectRequest = {
  title?: string;
  fundingGoal?: string;
  description?: string;
  duration?: string;
};

export type ProjectIdRequest = {
  projectId: string;
};
