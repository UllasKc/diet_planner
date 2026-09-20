const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, token, isForm = false } = {}) {
  const headers = {};
  if (!isForm && body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const data = await response.json();
      detail = data.detail || detail;
    } catch {
      // ignore parse failure
    }
    throw new ApiError(detail, response.status);
  }

  return response;
}

export async function requestJson(path, options) {
  const response = await request(path, options);
  return response.json();
}

export async function requestBlob(path, options) {
  const response = await request(path, options);
  return response.blob();
}

export { ApiError, API_URL };
