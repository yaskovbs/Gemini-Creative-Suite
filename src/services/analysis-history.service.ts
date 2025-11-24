import { Injectable, signal } from '@angular/core';

const ANALYSIS_HISTORY_KEY = 'gemini-analysis-history';

export interface AnalysisHistoryItem {
    id: number;
    mode: 'image' | 'video';
    prompt: string;
    fileName: string;
    result: string;
    timestamp: Date;
}

@Injectable({
  providedIn: 'root',
})
export class AnalysisHistoryService {
  history = signal<AnalysisHistoryItem[]>([]);

  constructor() {
    this.loadHistory();
  }

  private loadHistory() {
    if (typeof localStorage !== 'undefined') {
      const storedHistory = localStorage.getItem(ANALYSIS_HISTORY_KEY);
      if (storedHistory) {
        // Parse and revive date objects
        const parsed = JSON.parse(storedHistory).map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp)
        }));
        this.history.set(parsed);
      }
    }
  }

  addHistoryItem(item: AnalysisHistoryItem) {
    this.history.update(currentHistory => {
        const newHistory = [item, ...currentHistory];
        this.saveHistory(newHistory);
        return newHistory;
    });
  }

  clearHistory() {
    this.history.set([]);
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(ANALYSIS_HISTORY_KEY);
    }
  }

  private saveHistory(history: AnalysisHistoryItem[]) {
     if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ANALYSIS_HISTORY_KEY, JSON.stringify(history));
     }
  }
}
