import {APIs, URLs} from '@apis';
import type {SplitterCustomer} from '../screens/LastMileConnectivityScreen/types';

export type CustomerMasterDetails = {
  customerMasterId?: number;
  mobile: string;
  mac: string;
  name: string;
  address: string;
  latLng: string;
  landmark: string;
};
const text = (value: unknown) => String(value ?? '').trim();

export function normalizeCustomerSearchInput(value: string): string {
  const query = value.trimStart();
  const isFormattedMac = /^([\da-f]{2}[:-]){5}[\da-f]{2}$/i.test(query);
  if (/^[\d\s()-]*$/.test(query) && !isFormattedMac) {
    return query.replace(/\D/g, '').slice(0, 10);
  }
  return query.slice(0, 17);
}

export function customerLookupQuery(search: string): string {
  const query = search.trim();
  const phone = query.replace(/[\s()-]/g, '');
  if (/^\d{10}$/.test(phone)) {
    return `?MobNo=${encodeURIComponent(phone)}`;
  }
  const mac = /^[\da-f]{12}$/i.test(query)
    ? query.match(/.{2}/g)!.join(':')
    : query.replace(/-/g, ':');
  if (/^([\da-f]{2}:){5}[\da-f]{2}$/i.test(mac)) {
    return `?MacAddress=${encodeURIComponent(mac)}`;
  }
  throw new Error(
    'Enter a valid 10-digit mobile number or MAC address, such as 32:5e:87:50:3f:39.',
  );
}

export async function lookupCustomerMaster(
  search: string,
): Promise<CustomerMasterDetails | null> {
  const params = customerLookupQuery(search);
  const response = await APIs.getRequestWithQuery({
    path: params.startsWith('?MacAddress=')
      ? URLs.getCustomerMasterDetailByMacAddress
      : URLs.getCustomerMasterDetailByMobNo,
    params,
    isAuth: true,
  });
  if (
    response?.success === false ||
    (response?.success !== true && Number(response?.status) !== 200)
  ) {
    throw new Error(
      response?.message || 'Could not fetch customer details. Please retry.',
    );
  }
  const data = response.data;
  if (data == null || (Array.isArray(data) && !data.length)) {
    return null;
  }
  if (Array.isArray(data) || typeof data !== 'object') {
    throw new Error('Invalid customer response. Please retry.');
  }
  if (
    !data.id &&
    !text(data.name) &&
    !text(data.mobNo) &&
    !text(data.macAddress)
  ) {
    return null;
  }
  return {
    customerMasterId: Number(data.id) > 0 ? Number(data.id) : undefined,
    mobile: text(data.mobNo),
    mac: text(data.macAddress),
    name: text(data.name),
    address: text(data.installationAddress),
    latLng: text(data.latLng),
    landmark: text(data.installationLandmark ?? data.landmark),
  };
}

export function applyCustomerMasterDetails(
  form: SplitterCustomer,
  customer: CustomerMasterDetails,
  deviceGpsLatLng: string | null,
): SplitterCustomer {
  return {
    ...form,
    ...customer,
    latLng:
      deviceGpsLatLng && form.latLng === deviceGpsLatLng
        ? form.latLng
        : customer.latLng,
  };
}
