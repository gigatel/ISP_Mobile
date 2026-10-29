import type {Splitter, SplitterCustomer} from './types';
import type {GigCoreAssignment} from '../../services/nearbyGigRoutes';

export const SAMPLE_CUSTOMERS = [
  {
    tube: '1',
    core: '2',
    mobile: '9926066378',
    name: 'Apex Enterprises',
    address: 'Fabric Station, 29, Kalkaji Main Rd, Krishna Market',
    latLng: '28.54123085, 77.25460640',
    online: true,
  },
  {
    tube: '1',
    core: '3',
    mobile: '6565656565',
    name: 'Apex Enterprises',
    address: 'G48, 11, Kalkaji, Block G, Kalkaji, New Delhi',
    latLng: '28.54123085, 77.25460640',
    online: true,
  },
  {
    tube: '1',
    core: '4',
    mobile: '9999999999',
    name: 'Apex Enterprises',
    address: 'B-141, Third Floor, Block E, Kalkaji, New Delhi',
    latLng: '28.54123085, 77.25460640',
    online: false,
  },
  {
    tube: '1',
    core: '5',
    mobile: '9926066378',
    name: 'Apex Enterprises',
    address: 'Near City Park, Kalkaji, Block E, New Delhi',
    latLng: '28.54123085, 77.25460640',
    online: false,
  },
];

export const previewPortCount = (splitter: Splitter) =>
  splitter.source === 'api'
    ? Math.max(splitter.totalPorts ?? 0, splitter.free, 8)
    : 8;

const connections = new Map<string, (SplitterCustomer | null)[]>();
const localEdits = new Map<string, Map<number, SplitterCustomer>>();

export const customerCoreAssignment = (
  customer?: SplitterCustomer,
): GigCoreAssignment | undefined =>
  customer?.gig && Number(customer.tube) > 0 && Number(customer.core) > 0
    ? {
        fiberMappingId: customer.routeFiberMappingId ?? customer.fiberMappingId,
        fiberCode: customer.gig,
        tube: Number(customer.tube),
        core: Number(customer.core),
      }
    : undefined;

export function getCustomerCoreReservations(exclude?: {
  splitterId: string;
  leg: number;
}): GigCoreAssignment[] {
  const assignments: GigCoreAssignment[] = [];
  connections.forEach((customers, splitterId) =>
    customers.forEach((customer, index) => {
      if (splitterId === exclude?.splitterId && index === exclude.leg - 1) {
        return;
      }
      const assignment = customerCoreAssignment(customer ?? undefined);
      if (assignment) {
        assignments.push(assignment);
      }
    }),
  );
  return assignments;
}

export function mergeApiCustomerConnections(
  splitter: Splitter,
  customers: (SplitterCustomer | null)[],
) {
  const updated = customers.slice();
  localEdits.get(splitter.id)?.forEach((customer, index) => {
    if (index < updated.length) {
      updated[index] = {...customer};
    }
  });
  connections.set(splitter.id, updated);
  return updated.slice();
}

export function getPreviewConnections(
  splitter: Splitter,
): (SplitterCustomer | null)[] {
  const saved = connections.get(splitter.id);
  if (saved) {
    return saved.slice();
  }
  return Array.from({length: previewPortCount(splitter)}, (_, index) =>
    splitter.source !== 'api' && index < 8 - splitter.free
      ? {
          ...SAMPLE_CUSTOMERS[index % SAMPLE_CUSTOMERS.length],
          mac: 'A1:B2:C3:D4:E5:F6',
          connectivity: 'Virtual GIG',
          gig: 'GIG-01',
          landmark: 'Near City Park',
        }
      : null,
  );
}

export function savePreviewConnection(
  splitter: Splitter,
  leg: number,
  customer: SplitterCustomer,
) {
  const updated = getPreviewConnections(splitter);
  if (leg < 1 || leg > updated.length) {
    throw new Error('Invalid splitter leg');
  }
  const assignment = customerCoreAssignment(customer);
  if (
    assignment &&
    getCustomerCoreReservations({splitterId: splitter.id, leg}).some(
      other =>
        ((other.fiberMappingId !== undefined &&
          other.fiberMappingId === assignment.fiberMappingId) ||
          other.fiberCode.toLowerCase() ===
            assignment.fiberCode.toLowerCase()) &&
        other.tube === assignment.tube &&
        other.core === assignment.core,
    )
  ) {
    throw new Error(
      'This core is already connected to another customer. Select a different core.',
    );
  }
  updated[leg - 1] = {...customer};
  const edits =
    localEdits.get(splitter.id) ?? new Map<number, SplitterCustomer>();
  edits.set(leg - 1, {...customer});
  localEdits.set(splitter.id, edits);
  connections.set(splitter.id, updated);
}

export function invalidateCustomerConnections(splitter: Splitter) {
  connections.delete(splitter.id);
  localEdits.delete(splitter.id);
}
