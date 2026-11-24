import axios from "axios";

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:4100/api/v1",
  timeout: 20000,
  withCredentials: true,
});

export function apiMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "API request failed."
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error.";
}
