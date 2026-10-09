import { api } from "./client";

export type CityLocation = {
  cityName: string;
  stateName: string;
  countryName: string;
  stateCode: string;
  countryCode: string;
};

export const locationApi = {
  searchCities: (search: string, limit = 12) =>
    api
      .get("/locations/cities", {
        params: { search, limit },
      })
      .then((response) => response.data),
};
