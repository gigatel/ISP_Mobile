import {Preferences} from '@utils';

const getText = (value: unknown) => String(value ?? '').trim();

const getMasterId = (master: any) =>
  getText(master?.id ?? master?.Id ?? master?.masterId ?? master?.MasterId);

const getMasterName = (master: any) =>
  getText(master?.name ?? master?.Name ?? master?.masterName ?? master?.MasterName)
    .toLowerCase();

const getMasterLatLng = (master: any) =>
  getText(master?.latLng ?? master?.LatLng ?? master?.latlng).replace(/\s/g, '');

const getMasterType = (master: any) =>
  getText(master?.masterType ?? master?.MasterType ?? master?.type).toLowerCase();

const STANDALONE_MASTER_TYPES = new Set(['pole', 'tree', 'building']);

export const isFreeAirPlacedMaster = (master: any) => {
  const placementMode = getText(
    master?.placementMode ?? master?.PlacementMode,
  ).toLowerCase();
  const placementText = getText(master?.extra2 ?? master?.Extra2).toLowerCase();

  return (
    placementMode === 'air' ||
    placementText === 'placed in the air' ||
    placementText === 'placed in air'
  );
};

export const isStandalonePlacedMaster = (master: any) =>
  STANDALONE_MASTER_TYPES.has(getMasterType(master)) &&
  !isFreeAirPlacedMaster(master);

const isSameMaster = (first: any, second: any) => {
  const firstId = getMasterId(first);
  const secondId = getMasterId(second);
  const sameType = getMasterType(first) === getMasterType(second);
  const sameName = getMasterName(first) === getMasterName(second);
  const sameLocation = getMasterLatLng(first) === getMasterLatLng(second);

  if (
    firstId &&
    secondId &&
    firstId !== '0' &&
    secondId !== '0' &&
    firstId === secondId &&
    sameType &&
    (sameName || sameLocation)
  ) {
    return true;
  }

  return sameType && sameName && sameLocation;
};

export const loadRecentlyAddedMasters = (): any[] => {
  const stored = Preferences.getData(Preferences.KEY.RECENTLY_ADDED_MASTERS);
  return Array.isArray(stored) ? stored : [];
};

export const saveRecentlyAddedMaster = (master: any) => {
  const stored = loadRecentlyAddedMasters();
  const existingIndex = stored.findIndex(item => isSameMaster(item, master));
  const next =
    existingIndex >= 0
      ? stored.map((item, index) =>
          index === existingIndex ? {...item, ...master} : item,
        )
      : [...stored, master];

  // Keep a bounded refresh fallback; the API remains the permanent source.
  Preferences.setData(
    Preferences.KEY.RECENTLY_ADDED_MASTERS,
    next.slice(-100),
  );
};

export const loadStandalonePlacedMasters = (): any[] => {
  const stored = Preferences.getData(
    Preferences.KEY.STANDALONE_PLACED_MASTERS,
  );
  const dedicated = Array.isArray(stored)
    ? stored.filter(isStandalonePlacedMaster)
    : [];
  const legacy = loadRecentlyAddedMasters().filter(isStandalonePlacedMaster);

  return [...dedicated, ...legacy].filter(
    (master, index, list) =>
      list.findIndex(item => isSameMaster(item, master)) === index,
  );
};

export const saveStandalonePlacedMaster = (master: any) => {
  if (!isStandalonePlacedMaster(master)) {
    return;
  }

  const stored = loadStandalonePlacedMasters();
  const existingIndex = stored.findIndex(item => isSameMaster(item, master));
  const next =
    existingIndex >= 0
      ? stored.map((item, index) =>
          index === existingIndex ? {...item, ...master} : item,
        )
      : [...stored, master];

  Preferences.setData(
    Preferences.KEY.STANDALONE_PLACED_MASTERS,
    next.slice(-100),
  );
  saveRecentlyAddedMaster(master);
};

export const loadFreeAirPlacedMasters = (): any[] => {
  const stored = Preferences.getData(Preferences.KEY.AIR_PLACED_MASTERS);
  return Array.isArray(stored) ? stored.filter(isFreeAirPlacedMaster) : [];
};

export const saveFreeAirPlacedMaster = (master: any) => {
  if (!isFreeAirPlacedMaster(master)) {
    return;
  }

  const stored = loadFreeAirPlacedMasters();
  const existingIndex = stored.findIndex(item => isSameMaster(item, master));
  const next =
    existingIndex >= 0
      ? stored.map((item, index) =>
          index === existingIndex ? {...item, ...master} : item,
        )
      : [...stored, master];

  Preferences.setData(Preferences.KEY.AIR_PLACED_MASTERS, next);
  saveRecentlyAddedMaster(master);
};
