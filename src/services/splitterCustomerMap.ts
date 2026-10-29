import type {
  Splitter,
  SplitterCustomer,
} from '../screens/LastMileConnectivityScreen/types';
import {parseSplitterCoordinate} from './lastMileConnectivityService';
import type {SplitterCoordinate} from './lastMileConnectivityService';
import {getSplitterCustomers} from './lastMileSplitterCustomers';

export type SplitterMapConnectionSummary = {
  totalCustomers: number;
  connectedLegs: number[];
};

export type SplitterCustomerLink = {
  key: string;
  splitter: Splitter;
  splitterNumber: number;
  leg: number;
  customer: SplitterCustomer;
  coordinates: [SplitterCoordinate, SplitterCoordinate];
};

export function buildSplitterCustomerLinks(
  splitter: Splitter,
  customers: (SplitterCustomer | null)[],
  splitterNumber: number,
): {links: SplitterCustomerLink[]; missingCoordinates: number} {
  const start = parseSplitterCoordinate(
    `${splitter.latitude},${splitter.longitude}`,
  );
  const links: SplitterCustomerLink[] = [];
  let missingCoordinates = 0;
  customers.forEach((customer, index) => {
    if (!customer) {
      return;
    }
    const end = parseSplitterCoordinate(customer.latLng);
    if (!start || !end) {
      missingCoordinates += 1;
      return;
    }
    links.push({
      key: `${splitter.id}:${index + 1}`,
      splitter,
      splitterNumber,
      leg: index + 1,
      customer,
      coordinates: [start, end],
    });
  });
  return {links, missingCoordinates};
}

export function getDistinctCustomerMapLines(links: SplitterCustomerLink[]) {
  const lines = new Map<
    string,
    {key: string; coordinates: SplitterCustomerLink['coordinates']}
  >();
  links.forEach(link => {
    const [splitter, customer] = link.coordinates;
    const start = `${splitter.latitude},${splitter.longitude}`;
    const end = `${customer.latitude},${customer.longitude}`;
    if (start === end) {
      return;
    }
    const key = `${start}:${end}`;
    if (!lines.has(key)) {
      lines.set(key, {key, coordinates: [splitter, customer]});
    }
  });
  return Array.from(lines.values());
}

export async function loadSplitterCustomerLinks(
  splitters: Splitter[],
  isCurrent: () => boolean = () => true,
) {
  const results: {
    links: SplitterCustomerLink[];
    missingCoordinates: number;
    summary: SplitterMapConnectionSummary;
  }[] = [];
  const failedSplitterIds: string[] = [];
  let nextIndex = 0;
  const worker = async () => {
    while (isCurrent() && nextIndex < splitters.length) {
      const index = nextIndex++;
      const splitter = splitters[index];
      try {
        const customers = await getSplitterCustomers(splitter);
        if (isCurrent()) {
          results[index] = {
            ...buildSplitterCustomerLinks(splitter, customers, index + 1),
            summary: {
              totalCustomers: customers.filter(Boolean).length,
              connectedLegs: customers.flatMap((customer, legIndex) =>
                customer ? [legIndex + 1] : [],
              ),
            },
          };
        }
      } catch {
        if (isCurrent()) {
          failedSplitterIds.push(splitter.id);
        }
      }
    }
  };
  await Promise.all(
    Array.from({length: Math.min(3, splitters.length)}, worker),
  );
  return {
    links: results.flatMap(result => result.links),
    missingCoordinates: results.reduce(
      (count, result) => count + result.missingCoordinates,
      0,
    ),
    failedSplitterIds,
    connectionsBySplitter: Object.fromEntries(
      results.flatMap((result, index) =>
        result ? [[splitters[index].id, result.summary]] : [],
      ),
    ) as Record<string, SplitterMapConnectionSummary>,
  };
}
