import axios from "axios";

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:4100/api/v1",
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const userCode =
    localStorage.getItem("userCode") ||
    import.meta.env.VITE_USER_CODE;

  if (userCode) {
    config.headers["x-user-code"] = userCode;
  }

  config.headers["x-user-name"] =
    localStorage.getItem("userName") ||
    "System Administrator";
  config.headers["x-user-role"] =
    localStorage.getItem("userRole") ||
    "Administrator";

  const permissions =
    localStorage.getItem("userPermissions") ||
    import.meta.env.VITE_USER_PERMISSIONS;

  if (permissions) {
    config.headers["x-user-permissions"] = permissions;
  }

  return config;
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
