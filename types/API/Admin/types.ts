export type AdminLoginRequest = {
  email: string;
  password: string;
};

export type AdminLoginResponse = {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    isAdmin: boolean;
  };
};

export type AdminGetDraftProjectsRequest = {
  page?: number;
  limit?: number;
};

export type AdminGetDraftProjectsResponse = {
  projects: any[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type AdminProjectIdRequest = {
  projectId: string;
};

export type AdminApproveRejectProjectRequest = {
  action: "approve" | "reject";
  reason?: string;
};

export type AdminApproveRejectProjectResponse = {
  project: any;
  message: string;
};

export type AdminGetProjectDetailsRequest = {
  projectId: string;
};

export type AdminGetProjectDetailsResponse = {
  project: any;
  fundingStats: {
    totalRaised: number;
    totalInvestors: number;
    fundingProgress: number;
  };
};
