import { s_storage } from "./storage.js";
import { notify } from "./notify.js";

// Constants
const GRANT_TYPE = 'password';
const CLIENT_ID = 'seedr_chrome';
const ACCESS_TOKEN_URL = 'https://www.seedr.cc/api/token';
const API_URL = 'https://www.seedr.cc/api/resource';

export const oauth = {
  grant_type: GRANT_TYPE,
  client_id: CLIENT_ID,
  access_token_url: ACCESS_TOKEN_URL,
  refresh_token_url: ACCESS_TOKEN_URL,
  apiUrl: API_URL,

  refreshTimeout: null,
  username: '',
  access_token: '',
  refresh_token: '',

  init() {
    setTimeout(() => this.initializeTokens(), 0);
  },

  async initializeTokens() {
    try {
      const accessToken = await s_storage.get('access_token');
      if (accessToken !== '') {
        this.refresh_token = await s_storage.get('refresh_token');
        this.access_token = accessToken;
        this.username = await s_storage.get('username');
        this.scheduleTokenRefresh(180000); // Refresh token 3 minutes before expiry
      }
    } catch (error) {
      console.error('Error initializing tokens:', error);
    }
  },

  scheduleTokenRefresh(delay) {
    clearTimeout(this.refreshTimeout);
    this.refreshTimeout = setTimeout(() => this.getTokenFromRefresh(), delay);
  },

  createFormData(data) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Object && 'filename' in value) {
        formData.append(key, value.data, value.filename);
      } else {
        formData.append(key, value);
      }
    }
    return formData;
  },

  notifyLoginSuccess() {
    chrome.tabs.query({ active: true }, (tabs) => {
      const tab = tabs[0];
      notify('Seedr: extension now logged in!', 'success', 2000,
          [{ addClass: 'seedr-button seedr-reset seedr-button-success', text: 'Visit Seedr >', url: "https://www.seedr.cc/" }],
          tab.id
      );
    });
  },

  async testToken() {
    if (this.access_token === '') {
      return false;
    }

    try {
      const formData = this.createFormData({ 'func': 'test', 'access_token': this.access_token });
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        body: formData
      });

      return response.ok;
    } catch (error) {
      console.error('Error testing token:', error);
      return await this.getTokenFromRefresh();
    }
  },

  async handleSuccessfulLogin(data) {
    this.access_token = data.access_token;

    if (data.refresh_token) {
      this.refresh_token = data.refresh_token;
      this.username = data.username;
    }

    try {
      await s_storage.set('access_token', data.access_token);
      await s_storage.set('refresh_token', data.refresh_token);
      await s_storage.set('username', data.username);
    } catch (error) {
      console.error('Error saving login data:', error);
    }

    this.scheduleTokenRefresh(data.expires_in * 1000 - 180000);
    this.notifyLoginSuccess();
  },

  async getAccessToken(post_params) {
    const base_data = {
      "grant_type": this.grant_type,
      "client_id": this.client_id,
      "type": "login",
      ...post_params
    };

    try {
      const formData = this.createFormData(base_data);
      const response = await fetch(this.access_token_url, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw { status: response.status, data: data };
      }

      this.handleSuccessfulLogin(data);
      return { ...data, result: true };
    } catch (error) {
      console.error('Error:', error);
      if (error.status && error.data) {
        // This is our custom error object
        return { ...error.data, result: false };
      }
      return { result: false, error: 'Network error' };
    }
  },

  async getTokenFromRefresh() {
    const base_data = {
      "grant_type": "refresh_token",
      "refresh_token": this.refresh_token,
      "client_id": this.client_id
    };

    try {
      const formData = this.createFormData(base_data);
      const response = await fetch(this.refresh_token_url, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw { status: response.status, data: data };
      }

      this.access_token = data.access_token;
      await s_storage.set('access_token', data.access_token);

      this.scheduleTokenRefresh(data.expires_in * 1000 - 180000);
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      if (error.status && error.data) {
        // This is our custom error object
        console.error('Server error:', error.data);
      }
      this.access_token = '';
      return false;
    }
  },

  async login(username, access_token, access_token_expire, refresh_token) {
    this.username = username;
    this.access_token = access_token;
    this.refresh_token = refresh_token;

    try {
      await s_storage.set('access_token', access_token);
      await s_storage.set('refresh_token', refresh_token);
      await s_storage.set('username', username);
    } catch (error) {
      console.error('Error saving login data:', error);
    }

    this.scheduleTokenRefresh(access_token_expire * 1000 - 180000);
  },

  async logout() {
    this.access_token = '';
    this.refresh_token = '';
    this.username = '';

    try {
      await s_storage.set('access_token', '');
      await s_storage.set('refresh_token', '');
      await s_storage.set('username', '');
    } catch (error) {
      console.error('Error clearing login data:', error);
    }

    chrome.tabs.query({ active: true }, (tabs) => {
      const tab = tabs[0];
      notify('Seedr: Extension is now logged out!', 'success', 1500,
          [{ addClass: 'seedr-button seedr-reset seedr-button-success', text: 'Visit Seedr >', url: "https://www.seedr.cc/" }],
          tab.id
      );
    });
  },

  async query(func, data) {
    const formData = this.createFormData({
      ...data,
      func,
      access_token: this.access_token
    });

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        body: formData
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw { status: response.status, data: responseData };
      }

      return responseData;
    } catch (error) {
      console.error('Error:', error);

      if (error.status && error.data) {
        // This is our custom error object
        const result = error.data;
        if (result.error === 'invalid_token' || result.error === 'expired_token') {
          const refreshResult = await this.getTokenFromRefresh();
          if (refreshResult) {
            return this.query(func, data);
          } else {
            return { result: 'login_required' };
          }
        }
      }

      // If it's a network error or any other type of error
      return { result: 'fetch_error' };
    }
  }
};

// Initialize the oauth object
oauth.init();