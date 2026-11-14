export interface OnuCustomer {
  key: string;
  CustomerId: string;
  OrganizationId: string;
  ServerId: string;
  CustomerName?: string;
  MobNo?: string;
  Address?: string;
  LatLng?: string;
  MACAddress?: string;
  GenieAcsDeviceId?: string;
  LastInformUtc?: string;
  IsOnline: boolean;
  Status: string;
}
export interface OnuOfflineUpdate {
  OrganizationId: string;
  ServerId: string;
  Customers: OnuCustomer[];
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export const scopeId = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  return typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())
    ? value.trim()
    : null;
};
export function parseLatLng(value?: string) {
  const parts = value?.split(',');
  if (!parts || parts.length !== 2 || parts.some(part => !part.trim())) {
    return null;
  }
  const [latitude, longitude] = parts.map(part => Number(part.trim()));
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
    ? {latitude, longitude}
    : null;
}
export function parseOnuUpdate(
  raw: unknown,
  organization: string,
): OnuOfflineUpdate {
  const data: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!object(data)) {
    throw new Error('Invalid ONU update');
  }
  const OrganizationId = scopeId(data.OrganizationId);
  const ServerId = scopeId(data.ServerId);
  if (
    OrganizationId !== organization ||
    !ServerId ||
    !Array.isArray(data.Customers)
  ) {
    throw new Error('Invalid ONU scope or customers');
  }
  const Customers: OnuCustomer[] = [];
  for (const item of data.Customers) {
    if (!object(item)) {
      continue;
    }
    const CustomerId = scopeId(item.CustomerId);
    if (!CustomerId) {
      continue;
    }
    // Only explicit statuses can add/remove a customer. Contradictory statuses are rejected.
    const status =
      typeof item.Status === 'string' ? item.Status.trim().toLowerCase() : '';
    const online =
      typeof item.IsOnline === 'boolean'
        ? item.IsOnline
        : status === 'online'
        ? true
        : status === 'offline'
        ? false
        : null;
    if (
      online === null ||
      (online && status === 'offline') ||
      (!online && status === 'online')
    ) {
      continue;
    }
    const customer: OnuCustomer = {
      key: `${OrganizationId}:${ServerId}:${CustomerId}`,
      OrganizationId,
      ServerId,
      CustomerId,
      IsOnline: online,
      Status: online ? 'Online' : 'Offline',
    };
    for (const field of [
      'CustomerName',
      'MobNo',
      'Address',
      'LatLng',
      'MACAddress',
      'GenieAcsDeviceId',
      'LastInformUtc',
    ] as const) {
      const value = item[field];
      if (typeof value === 'string') {
        customer[field] = value;
      }
    }
    Customers.push(customer);
  }
  return {OrganizationId, ServerId, Customers};
}
export const lastInformTime = (value?: string) => {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : 0;
};
export function selectOffline(
  records: Record<string, OnuCustomer>,
  query = '',
) {
  const search = query.trim().toLowerCase();
  return Object.values(records)
    .filter(
      customer =>
        !customer.IsOnline &&
        (!search ||
          [
            customer.CustomerName,
            customer.CustomerId,
            customer.MobNo,
            customer.MACAddress,
          ].some(value => value?.toLowerCase().includes(search))),
    )
    .sort(
      (a, b) =>
        lastInformTime(b.LastInformUtc) - lastInformTime(a.LastInformUtc) ||
        a.key.localeCompare(b.key),
    );
}
