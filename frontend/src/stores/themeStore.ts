import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'light',

      toggleTheme: () => {
        set((state) => ({
          mode: state.mode === 'light' ? 'dark' : 'light'
        }));
      },

      setTheme: (mode: ThemeMode) => {
        set({ mode });
      },
    }),
    {
      name: 'helix-theme',
    }
  )
);
