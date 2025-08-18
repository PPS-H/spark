export type CreateProjectRequest = {
  title: string;
  fundingGoal: string;
  description: string;
  duration: string;
  songTitle: string;
  artistName: string;
  isrcCode: string;
  upcCode?: string;
  spotifyTrackLink: string;
  spotifyTrackId: string;
  youtubeMusicLink?: string;
  youtubeVideoId?: string;
  deezerTrackLink?: string;
  deezerTrackId?: string;
  releaseType: 'single' | 'album' | 'ep';
  genre: string;
  releaseDate?: string;
  expectedReleaseDate?: string;
  fundingDeadline?: string;


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
