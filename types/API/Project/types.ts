export type CreateProjectRequest = {
  title: string;
  fundingGoal: string;
  description: string;
  duration: string;
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
