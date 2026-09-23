export const TEAM_STORAGE_KEY = 'challenge100-team';
export const LOCAL_USER_STORAGE_KEY = 'challenge100-local-user';

const TEAM_NAME_DEFAULTS = ['하니', '올리', '벨라', '나쵸', '운동해'];

export const getCurrentLocalUserId = () => {
  if (typeof window === 'undefined') {
    return 'default-user';
  }

  const existingUserId = window.sessionStorage?.getItem(LOCAL_USER_STORAGE_KEY);
  if (existingUserId) {
    return existingUserId;
  }

  const generatedUserId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    window.sessionStorage?.setItem(LOCAL_USER_STORAGE_KEY, generatedUserId);
  } catch (error) {
    console.warn('Failed to persist local user id:', error);
  }

  return generatedUserId;
};

export const getUserScopedStorageKey = (baseKey, userId = getCurrentLocalUserId()) => {
  if (!baseKey) {
    return baseKey;
  }

  if (!userId) {
    return baseKey;
  }

  return `${baseKey}:${userId}`;
};

const generate100Days = () => {
  const days = [];
  const startDate = new Date(2026, 8, 23);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  for (let i = 1; i <= 100; i += 1) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + (i - 1));

    const month = currentDate.getMonth() + 1;
    const date = currentDate.getDate();
    const dayOfWeek = dayNames[currentDate.getDay()];

    days.push({
      dayNum: i,
      month,
      dateStr: `${month}.${date}`,
      dayOfWeek,
      checked: false,
      note: '',
    });
  }

  return days;
};

export const createParticipant = (name, index = 0) => ({
  id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`,
  name,
  days: generate100Days(),
});

export const createDefaultTeam = () => {
  const participants = TEAM_NAME_DEFAULTS.map((name, index) => createParticipant(name, index));

  return {
    selectedId: participants[0].id,
    participants,
  };
};

export const getUserScopedStorageDataKey = (baseKey = TEAM_STORAGE_KEY) =>
  getUserScopedStorageKey(baseKey, getCurrentLocalUserId());

export const safeReadStorage = (key) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`Failed to read storage key: ${key}`, error);
    return null;
  }
};

export const safeWriteStorage = (key, value) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to write storage key: ${key}`, error);
    return false;
  }
};
