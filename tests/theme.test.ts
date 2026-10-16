import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { mockStorage } from './fixtures/indexeddb';

const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let systemDark: boolean;
let systemChange: () => void;
let toggle: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  systemDark = false;
  systemChange = () => {};
  toggle = vi.fn();
  vi.stubGlobal('window', {
    matchMedia: () => ({
      get matches() { return systemDark; },
      addEventListener: (_type: string, listener: () => void) => { systemChange = listener; },
    }),
  });
  vi.stubGlobal('document', { documentElement: { classList: { toggle } } });
});

afterEach(() => {
  if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

/** Blocked site data: reading localStorage itself throws, as browsers do when cookies are blocked. */
function blockStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('Access is denied for this document.', 'SecurityError'); },
  });
}

/** The operating system switches between light and dark while the app is open. */
function switchSystemTheme(dark: boolean) {
  systemDark = dark;
  systemChange();
}

const load = () => import('../src/lib/stores/theme');

describe('theme preference', () => {
  it('starts with the system theme when site storage is blocked', async () => {
    blockStorage();
    systemDark = true;
    const { themePreference } = await load();
    expect(get(themePreference)).toBe('system');
    expect(toggle).toHaveBeenLastCalledWith('dark', true);
    switchSystemTheme(false);
    expect(toggle).toHaveBeenLastCalledWith('dark', false);
  });

  it('applies a choice for the rest of the session when site storage is blocked', async () => {
    blockStorage();
    const { themePreference } = await load();
    expect(() => themePreference.set('dark')).not.toThrow();
    expect(get(themePreference)).toBe('dark');
    expect(toggle).toHaveBeenLastCalledWith('dark', true);
    // The unreadable stored default must not replace the choice when the system theme changes.
    switchSystemTheme(true);
    switchSystemTheme(false);
    expect(toggle).toHaveBeenLastCalledWith('dark', true);
  });

  it('keeps a choice that full storage could not save', async () => {
    const data = mockStorage();
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    const { themePreference } = await load();
    expect(() => themePreference.set('light')).not.toThrow();
    switchSystemTheme(true);
    expect(toggle).toHaveBeenLastCalledWith('dark', false);
    expect(data.has('o3d_theme')).toBe(false);
  });

  it('remembers a choice across reloads when storage works', async () => {
    const data = mockStorage();
    (await load()).themePreference.set('dark');
    expect(data.get('o3d_theme')).toBe('dark');
    vi.resetModules();
    const { themePreference } = await load();
    expect(get(themePreference)).toBe('dark');
    switchSystemTheme(false);
    expect(toggle).toHaveBeenLastCalledWith('dark', true);
  });
});
