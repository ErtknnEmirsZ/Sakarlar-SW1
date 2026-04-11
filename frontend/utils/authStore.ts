import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = '@spectrun_admin_v1';
const ADMIN_USER = 'Emir';
const ADMIN_PASS = 'Ertekinelvan54';

class AuthStore {
  isAdmin = false;

  async login(username: string, password: string): Promise<boolean> {
    if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
      this.isAdmin = true;
      try { await AsyncStorage.setItem(AUTH_KEY, '1'); } catch {}
      return true;
    }
    return false;
  }

  async logout(): Promise<void> {
    this.isAdmin = false;
    try { await AsyncStorage.removeItem(AUTH_KEY); } catch {}
  }

  async init(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(AUTH_KEY);
      this.isAdmin = val === '1';
    } catch {
      this.isAdmin = false;
    }
    return this.isAdmin;
  }
}

export const authStore = new AuthStore();
