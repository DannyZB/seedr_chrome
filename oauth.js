import { s_storage } from "./storage";

export class SeedrOAuth {
  constructor(grant_type, client_id, access_token_url, apiUrl) {
    this.grant_type = grant_type;
    this.client_id = client_id;
    this.access_token_url = access_token_url;
    this.refresh_token_url = access_token_url;
    this.apiUrl = apiUrl;

    this.refreshTimeout = null;
    this.username = '';
    this.access_token = '';
    this.refresh_token = '';

    setTimeout(() => this.initializeTokens(), 2500);
  }

  initializeTokens() {
    if (s_storage.get('access_token') !== '') {
      this.refresh_token = s_storage.get('refresh_token');
      this.access_token = s_storage.get('access_token');
      this.username = s_storage.get('username');
      this.scheduleTokenRefresh(180000); // Refresh token 3 minutes before expiry
    }
  }

  scheduleTokenRefresh(delay) {
    clearTimeout(this.refreshTimeout);
    this.refreshTimeout = setTimeout(() => this.getTokenFromRefresh(), delay);
  }

  async getAccessToken(post_params) {
    const base_data = {
      "grant_type": this.grant_type,
      "client_id": this.client_id
    };

    try {
      const response = await fetch(this.access_token_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...base_data, ...post_params })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      this.handleSuccessfulLogin(data);
      return { ...data, result: true };
    } catch (error) {
      console.error('Error:', error);
      return { result: false };
    }
  }

  handleSuccessfulLogin(data) {
    this.access_token = data.access_token;
    this.refresh_token = data.refresh_token;
    this.username = data.username;

    s_storage.set('access_token', data.access_token);
    s_storage.set('refresh_token', data.refresh_token);
    s_storage.set('username', data.username);

    this.scheduleTokenRefresh(data.expires_in * 1000 - 180000);

    this.notifyLoginSuccess();
  }

  notifyLoginSuccess() {
    chrome.tabs.query({ active: true }, (tabs) => {
      const tab = tabs[0];
      notify('Seedr: extension now logged in!', 'success', 2000,
          [{ addClass: 'seedr-button seedr-reset seedr-button-success', text: 'Visit Seedr >', url: "https://www.seedr.cc/" }],
          tab.id
      );
    });
  }

  async testToken() {
    if (this.access_token === '') {
      return false;
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 'func': 'test', 'access_token': this.access_token })
      });

      return response.ok;
    } catch (error) {
      console.error('Error testing token:', error);
      return await this.getTokenFromRefresh();
    }
  }

  async getTokenFromRefresh() {
    const base_data = {
      "grant_type": "refresh_token",
      "refresh_token": this.refresh_token,
      "client_id": this.client_id
    };

    try {
      const response = await fetch(this.refresh_token_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(base_data)
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      this.access_token = data.access_token;
      s_storage.set('access_token', data.access_token);

      this.scheduleTokenRefresh(data.expires_in * 1000 - 180000);
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      this.access_token = '';
      return false;
    }
  }

  login(username, access_token, access_token_expire, refresh_token) {
    this.username = username;
    this.access_token = access_token;
    this.refresh_token = refresh_token;

    s_storage.set('access_token', access_token);
    s_storage.set('refresh_token', refresh_token);
    s_storage.set('username', username);

    this.scheduleTokenRefresh(access_token_expire * 1000 - 180000);
  }

  logout() {
    this.access_token = '';
    this.refresh_token = '';
    this.username = '';

    s_storage.set('access_token', '');
    s_storage.set('refresh_token', '');
    s_storage.set('username', '');

    chrome.tabs.query({ active: true }, (tabs) => {
      const tab = tabs[0];
      notify('Seedr: Extension is now logged out!', 'success', 1500,
          [{ addClass: 'seedr-button seedr-reset seedr-button-success', text: 'Visit Seedr >', url: "https://www.seedr.cc/" }],
          tab.id
      );
    });
  }

  async query(func, data) {
    const formData = new FormData();

    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Object && 'filename' in value) {
        formData.append(key, value.data, value.filename);
      } else {
        formData.append(key, value);
      }
    }

    formData.append('func', func);
    formData.append('access_token', this.access_token);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      return await response.json();
    } catch (error) {
      console.error('Error:', error);
      const result = error.response ? await error.response.json() : null;

      if (result && (result.error === 'invalid_token' || result.error === 'expired_token')) {
        const refreshResult = await this.getTokenFromRefresh();
        if (refreshResult) {
          return this.query(func, data);
        } else {
          return { result: 'login_required' };
        }
      } else {
        return { result: 'fetch_error' };
      }
    }
  }
}