export type RegisterUserRequest = {
  username: string;
  email: string;
  password: string;
  country?: string;
  favoriteGenre?: string;
  musicPlatforms?: string[];
  aboutTxt?: string;
  role?: string;

  artistBio: string;
  instagram: string;
  youtube: string;
  spotify: string;

  companyType: string;
  teamSize: string;
  website: string;
  companyDescription: string;
};

export type LoginUserRequest = {
  email: string;
  password: string;
};

export type UpdateUserProfileRequest = {
  username?: string;
  email?: string;
  password?: string;
  country?: string;
  favoriteGenre?: string;
  musicPlatforms?: string[];
  aboutTxt?: string;
  role?: string;
  artistBio?: string;
  instagram?: string;
  youtube?: string;
  spotify?: string;
  companyType?: string;
  teamSize?: string;
  website?: string;
  companyDescription?: string;
};

export type SendOTPRequest = {
  email: string;
  type: number;
};

export type VerifyOTPRequest = {
  userId: string;
  otp: number;
  type: number;
};

export type ChangePasswordType = {
  userId: string;
  password: string;
};
