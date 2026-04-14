// src/lib/apiService.jsx
// A common service class for API calls (JSX version, for React projects)

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

class ApiService {
  constructor(baseURL = BASE_URL) {
    this.baseURL = baseURL;
  }

  async logTime(seconds) {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${this.baseURL}/logtime`,
        { seconds },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return response.data;
    } catch (error) {
      // You may want to handle error more gracefully in a real app
      throw error.response?.data || error.message;
    }
  }

  // Add more API methods as needed
}

export default new ApiService("http://localhost:8000"); // You can set the base URL here or rely on environment variable

// Usage:
// import apiService from '../lib/apiService.jsx';
// apiService.logTime(30);
