import { Injectable, signal, computed } from '@angular/core';

const API_KEY_STORAGE_KEY = 'gemini-api-key';

@Injectable({
  providedIn: 'root',
})
export class ApiKeyService {
  apiKey = signal<string | null>(null);
  hasApiKey = computed(() => !!this.apiKey());

  constructor() {
    if (typeof localStorage !== 'undefined') {
      const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (storedKey) {
        this.apiKey.set(storedKey);
      }
    }
  }

  setApiKey(key: string) {
    if (key && key.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
      this.apiKey.set(key);
    }
  }

  clearApiKey() {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    this.apiKey.set(null);
  }
}
