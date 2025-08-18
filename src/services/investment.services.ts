// Helper functions for return calculation
export const getGenreMultiplier = (genre: string): number => {
  const genreMultipliers: { [key: string]: number } = {
    pop: 1.3,
    "hip-hop": 1.4,
    electronic: 1.2,
    rock: 1.1,
    jazz: 0.9,
    classical: 0.8,
    country: 1.0,
    "r&b": 1.2,
    indie: 1.0,
  };

  return genreMultipliers[genre?.toLowerCase()] || 1.0;
};

export const getCountryMultiplier = (country: string): number => {
  const countryMultipliers: { [key: string]: number } = {
    US: 1.5,
    UK: 1.3,
    Germany: 1.2,
    France: 1.1,
    Canada: 1.2,
    Australia: 1.1,
    India: 0.8,
    Brazil: 0.9,
  };

  return countryMultipliers[country] || 1.0;
};

export const getDurationMultiplier = (duration: string): number => {
  const durationMultipliers: { [key: string]: number } = {
    "6_months": 0.8,
    "1_year": 1.0,
    "2_years": 1.2,
    "5_years": 1.5,
    lifetime: 2.0,
  };

  return durationMultipliers[duration] || 1.0;
};
