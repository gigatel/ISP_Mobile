import {
  getCustomerCoreReservations,
  mergeApiCustomerConnections,
  savePreviewConnection,
} from '../src/screens/LastMileConnectivityScreen/customerPreview';
import type {
  Splitter,
  SplitterCustomer,
} from '../src/screens/LastMileConnectivityScreen/types';

const splitter: Splitter = {
  id: 'core-reservation-A',
  source: 'api',
  name: 'Reservation A',
  free: 2,
  latitude: null,
  longitude: null,
  distance: null,
};
const customer: SplitterCustomer = {
  tube: '1',
  core: '3',
  mobile: '9000000000',
  mac: 'A1:B2:C3:D4:E5:F6',
  name: 'Core Test',
  address: 'Test address',
  latLng: '28.6,77.2',
  online: true,
  connectivity: 'Physical GIG',
  gig: 'CORE-RESERVATION-TEST',
  landmark: '',
  fiberMappingId: 12345,
};

test('reserves saved cores across splitters and rejects a second customer on the same GIG/tube/core', () => {
  const other = {...splitter, id: 'core-reservation-B'};
  mergeApiCustomerConnections(splitter, [null, null]);
  mergeApiCustomerConnections(other, [null, null]);
  savePreviewConnection(splitter, 1, customer);
  expect(
    getCustomerCoreReservations({splitterId: other.id, leg: 1}),
  ).toContainEqual({
    fiberMappingId: 12345,
    fiberCode: customer.gig,
    tube: 1,
    core: 3,
  });
  expect(() => savePreviewConnection(other, 1, customer)).toThrow(
    'already connected to another customer',
  );
  expect(() =>
    savePreviewConnection(other, 1, {...customer, tube: '2'}),
  ).not.toThrow();
});

test('editing the same customer does not conflict with itself, and changing cores releases its old assignment', () => {
  expect(() =>
    savePreviewConnection(splitter, 1, {...customer, name: 'Edited'}),
  ).not.toThrow();
  savePreviewConnection(splitter, 1, {...customer, core: '5'});
  const reservations = getCustomerCoreReservations({
    splitterId: 'unrelated',
    leg: 1,
  });
  expect(
    reservations.some(
      item =>
        item.fiberCode === customer.gig && item.tube === 1 && item.core === 3,
    ),
  ).toBe(false);
  expect(
    reservations.some(
      item =>
        item.fiberCode === customer.gig && item.tube === 1 && item.core === 5,
    ),
  ).toBe(true);
});
