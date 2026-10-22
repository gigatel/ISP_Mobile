import {getData, setData} from './preferences';

// Read at request time so login updates also reach already-loaded modules.
export const getOlaMapApiKey = (): string => {
  const key = getData('OLA_MAPS_API_KEY');
  if (typeof key === 'string' && key.trim()) {
    return key.trim();
  }
  const loginKey = getData('LOGIN_RESPONSE')?.olaKey;
  return typeof loginKey === 'string' ? loginKey.trim() : '';
};

export const setOlaMapApiKey = (key: unknown) =>
  setData('OLA_MAPS_API_KEY', typeof key === 'string' ? key.trim() : '');
