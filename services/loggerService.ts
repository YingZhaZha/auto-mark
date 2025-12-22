
export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'INFO' | 'ERROR' | 'SUCCESS' | 'WARN';
  action: string;
  details?: string;
}

const LOG_STORAGE_KEY = 'app_user_logs';
const MAX_LOGS = 100;

export const Logger = {
  getLogs: (): LogEntry[] => {
    try {
      const logs = localStorage.getItem(LOG_STORAGE_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch (e) {
      return [];
    }
  },

  add: (type: LogEntry['type'], action: string, details?: string) => {
    try {
      const newLog: LogEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        timestamp: new Date().toLocaleString(),
        type,
        action,
        details
      };
      
      const currentLogs = Logger.getLogs();
      // Add to beginning, keep max limit
      const updatedLogs = [newLog, ...currentLogs].slice(0, MAX_LOGS);
      
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(updatedLogs));
      
      // Console backup
      if (type === 'ERROR') {
        console.error(`[${action}]`, details);
      } else {
        console.log(`[${action}]`, details);
      }
    } catch (e) {
      console.error("Logger failed", e);
    }
  },

  info: (action: string, details?: string) => Logger.add('INFO', action, details),
  success: (action: string, details?: string) => Logger.add('SUCCESS', action, details),
  warn: (action: string, details?: string) => Logger.add('WARN', action, details),
  error: (action: string, details?: any) => {
    let detailStr = '';
    if (details instanceof Error) {
        detailStr = details.message + '\n' + details.stack;
    } else if (typeof details === 'object') {
        detailStr = JSON.stringify(details);
    } else {
        detailStr = String(details);
    }
    Logger.add('ERROR', action, detailStr);
  },
  
  clear: () => {
    localStorage.removeItem(LOG_STORAGE_KEY);
  }
};
