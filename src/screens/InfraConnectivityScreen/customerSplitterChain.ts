import {CustomerCard, customerField} from './CustomerConnectivityCards';

export const previousSplitterMatch = (data: any, parentId: any): any => {
  if (parentId == null || parentId === '' || Number(parentId) <= 0) {
    return undefined;
  }
  if (Array.isArray(data)) {
    return data
      .map(item => previousSplitterMatch(item, parentId))
      .find(Boolean);
  }
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  if (String(customerField(data, 'splitterDetailId')) === String(parentId)) {
    return data;
  }
  return Object.values(data)
    .filter(value => value && typeof value === 'object')
    .map(value => previousSplitterMatch(value, parentId))
    .find(Boolean);
};

export const customerSplitterView = (
  cards: CustomerCard[],
  customerIndex: number,
  requestedStep: number,
) => {
  const customers = cards.filter(card => card.kind === 'customer');
  const target =
    customers[
      Math.min(Math.max(0, customerIndex), Math.max(0, customers.length - 1))
    ];
  const splitters = cards.filter(card => card.kind === 'splitter');
  const findSplitter = (id: any, code?: any) => {
    if (code != null && code !== '') {
      const byCode = splitters.find(
        card =>
          String(customerField(card.data, 'splitterCode', 'masterCode')) ===
          String(code),
      );
      if (byCode) {
        return byCode;
      }
    }
    if (id == null || id === '' || Number(id) === 0) {
      return undefined;
    }
    return (
      splitters.find(
        card =>
          String(
            customerField(
              card.data,
              'splitterId',
              'deviceId',
              'masterId',
              'id',
            ),
          ) === String(id),
      ) ||
      splitters.find(
        card => String(customerField(card.data, 'id')) === String(id),
      )
    );
  };
  const directId = customerField(
    target?.data,
    'splitterId',
    'connectedSplitterId',
    'parentSplitterId',
    'fromMasterId',
  );
  const directCode = customerField(target?.data, 'splitterCode');
  const first =
    findSplitter(directId, directCode) ||
    (splitters.length === 1 ? splitters[0] : undefined);
  const path: CustomerCard[] = [];
  const seen = new Set<string>();
  const seenRecords = new Set<string>();
  let cursor = first;
  while (cursor) {
    const id = String(
      customerField(cursor.data, 'splitterId', 'deviceId', 'masterId', 'id'),
    );
    const recordId = String(
      customerField(cursor.data, 'id') ||
        `${id}|${customerField(cursor.data, 'splitterCode')}`,
    );
    if (seenRecords.has(recordId)) {
      break;
    }
    seenRecords.add(recordId);
    const last = path[path.length - 1];
    if (seen.has(id)) {
      if (
        !last ||
        String(
          customerField(last.data, 'splitterId', 'deviceId', 'masterId', 'id'),
        ) !== id
      ) {
        break;
      }
      // A customer output leg and its parent master record describe the same
      // physical splitter. Enrich it rather than displaying that splitter twice.
      path[path.length - 1] = {
        kind: 'splitter',
        data: {
          ...cursor.data,
          ...last.data,
          id: cursor.data.id,
          parentId: cursor.data.parentId,
        },
      };
    } else {
      seen.add(id);
      path.push(cursor);
    }
    const parentId = customerField(
      cursor.data,
      'previousSplitterId',
      'parentSplitterId',
      'parentId',
      'fromMasterId',
    );
    if (parentId === '' || Number(parentId) === 0) {
      break;
    }
    const parent =
      splitters.find(
        card => String(customerField(card.data, 'id')) === String(parentId),
      ) || findSplitter(parentId);
    if (!parent) {
      // An ID is a real API reference, but the other fields must stay missing.
      path.push({
        kind: 'splitter',
        data: {splitterId: parentId, detailsUnavailable: true},
      });
      break;
    }
    cursor = parent;
  }
  const step = Math.min(
    Math.max(0, requestedStep),
    Math.max(0, path.length - 1),
  );
  const visible: CustomerCard[] =
    step === 0
      ? [...(path[0] ? [path[0]] : []), ...(target ? [target] : [])]
      : [path[step], path[step - 1], ...(target ? [target] : [])];
  return {
    customers,
    path,
    step,
    cards: visible,
    hasPrevious: step < path.length - 1,
    missingDetails: !!path[step]?.data.detailsUnavailable,
  };
};
