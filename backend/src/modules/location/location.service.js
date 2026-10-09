import {
  City,
  Country,
  State,
} from "country-state-city";

import { AppError } from "../../utils/AppError.js";

let searchableCities;

function getSearchableCities() {
  if (searchableCities) {
    return searchableCities;
  }

  const countries = new Map(
    Country.getAllCountries().map((country) => [
      country.isoCode,
      country.name,
    ])
  );

  const states = new Map(
    State.getAllStates().map((state) => [
      `${state.countryCode}:${state.isoCode}`,
      state.name,
    ])
  );

  searchableCities = City.getAllCities().map((city) => {
    const countryName =
      countries.get(city.countryCode) || city.countryCode;
    const stateName =
      states.get(`${city.countryCode}:${city.stateCode}`) ||
      city.stateCode ||
      "";

    return {
      cityName: city.name,
      stateName,
      countryName,
      stateCode: city.stateCode || "",
      countryCode: city.countryCode,
      searchText: `${city.name} ${stateName} ${countryName}`.toLocaleLowerCase(),
    };
  });

  return searchableCities;
}

export function searchCities(query = {}) {
  const search = String(query.search || "").trim();
  const requestedLimit = Number.parseInt(String(query.limit || 12), 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 30)
    : 12;

  if (search.length < 2) {
    throw new AppError(
      "Enter at least 2 characters to search for a city."
    );
  }

  const normalizedSearch = search.toLocaleLowerCase();
  const matches = [];

  for (const city of getSearchableCities()) {
    if (!city.searchText.includes(normalizedSearch)) {
      continue;
    }

    const normalizedCityName = city.cityName.toLocaleLowerCase();
    const startsWithCityName = normalizedCityName.startsWith(normalizedSearch);
    const exactCityName = normalizedCityName === normalizedSearch;

    matches.push({
      cityName: city.cityName,
      stateName: city.stateName,
      countryName: city.countryName,
      stateCode: city.stateCode,
      countryCode: city.countryCode,
      rank: exactCityName ? 0 : startsWithCityName ? 1 : 2,
    });
  }

  matches.sort(
    (left, right) =>
      left.rank - right.rank ||
      left.cityName.localeCompare(right.cityName) ||
      left.stateName.localeCompare(right.stateName) ||
      left.countryName.localeCompare(right.countryName)
  );

  return matches.slice(0, limit).map(({ rank, ...city }) => city);
}
