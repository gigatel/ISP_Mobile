import Geolocation from '@react-native-community/geolocation';
import {getGeoLocation} from '../src/utils/location';

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
}));
jest.mock('react-native-android-location-enabler', () => ({}));
jest.mock('react-native-permissions', () => ({}));
jest.mock('../src/utils/common', () => ({error: jest.fn()}));
jest.mock('../src/utils/preferences', () => ({
  getData: () => ({
    lat: 28.6,
    long: 77.2,
    locationTs: Date.now(),
    accuracy: 15,
  }),
  setData: jest.fn(),
}));
jest.mock('../src/services/LocationPosterCore', () => ({}));

const getCurrentPosition = Geolocation.getCurrentPosition as jest.Mock;

beforeEach(() => getCurrentPosition.mockReset());

test('master Fetch retries with a fresh high-accuracy request and rejects cached fallback', async () => {
  getCurrentPosition.mockImplementation((_success, failure) =>
    failure(new Error('GPS unavailable')),
  );

  await expect(getGeoLocation(true)).rejects.toThrow('GPS unavailable');
  expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  for (const call of getCurrentPosition.mock.calls) {
    expect(call[2]).toMatchObject({
      maximumAge: 0,
      enableHighAccuracy: true,
    });
  }
});

test('other location callers retain their recent-location fallback', async () => {
  getCurrentPosition.mockImplementation((_success, failure) =>
    failure(new Error('GPS unavailable')),
  );

  await expect(getGeoLocation()).resolves.toMatchObject({
    coords: {latitude: 28.6, longitude: 77.2},
  });
});

test('master Fetch preserves the full device coordinates', async () => {
  const fix = {
    coords: {latitude: 28.6123456789, longitude: 77.2123456789, accuracy: 8},
    timestamp: Date.now(),
  };
  getCurrentPosition.mockImplementation(success => success(fix));

  await expect(getGeoLocation(true)).resolves.toBe(fix);
});
