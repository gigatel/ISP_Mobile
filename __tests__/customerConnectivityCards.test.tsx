import React from 'react';
import renderer from 'react-test-renderer';
import {Text} from 'react-native';
import CustomerConnectivityCards, {
  customerCardsOf,
} from '../src/screens/InfraConnectivityScreen/CustomerConnectivityCards';

jest.mock('../src/res', () => ({FONTS: {}}));
jest.mock('../src/screens/InfraConnectivityScreen/ConnectivityIcons', () => ({
  MasterMapIcon: () => null,
}));
const details = [
  {
    id: 100,
    infraType: 'Splitter',
    deviceId: 10,
    deviceMasterId: 1,
    deviceName: 'API splitter',
    remarks: 'Splitter remark',
  },
  {
    id: 101,
    infraType: 'Customer',
    tube: 0,
    core1: 0,
    core1Color: '',
    remarks: 'Link remark',
  },
];
const connection = {
  id: 200,
  splitterId: 5,
  parentId: 55,
  splitterCode: 'SPL-5-L2-N1/1',
  splitterType: null,
  masterCode: null,
  address: null,
  tubeNo: 1,
  coreNo: 7,
  customerName: 'API Customer A',
  customerMobileNo: '9000000000',
  customerAddress: 'API customer address',
  customerLatLng: '28.55,77.25',
  remark: 'API customer remark',
};
const circuit = {
  circuitCode: 'CIR/Customer/26-27/1',
  fullDetails: {details, splitterDetails: [connection]},
};

test('joins actual fullDetails.details and splitterDetails and displays response customer fields', () => {
  const cards = customerCardsOf(details, circuit);
  expect(cards.filter(card => card.kind === 'splitter')).toHaveLength(2);
  expect(cards.filter(card => card.kind === 'customer')).toHaveLength(1);
  expect(cards.find(card => card.kind === 'customer')?.data).toEqual(
    expect.objectContaining({
      customerName: 'API Customer A',
      tubeNo: 1,
      coreNo: 7,
      customerMobileNo: '9000000000',
    }),
  );
  const view = renderer.create(
    <CustomerConnectivityCards items={details} circuit={circuit} />,
  );
  const texts = view.root.findAllByType(Text).map(node => node.props.children);
  expect(texts).toEqual(
    expect.arrayContaining([
      'Splitter Information',
      'Customer Information',
      'API splitter',
      'SPL-5-L2-N1/1',
      'API Customer A',
      '9000000000',
      'API customer address',
      '28.55,77.25',
      '1',
      '7',
    ]),
  );
  expect(texts).not.toContain('CIR/Customer/26-27/1');
  expect(texts).not.toContain('Switch Name:');
  expect(texts).not.toContain('Rack Name:');
  expect(texts).not.toContain('Splitter Name 123');
  view.unmount();
});
test('keeps multiple customer connections and splitter output legs instead of deduplicating their shared splitter ID', () => {
  const next = {
    ...connection,
    id: 201,
    splitterCode: 'SPL-5-L2-N1/2',
    customerName: 'API Customer B',
    coreNo: 2,
  };
  const cards = customerCardsOf(details, {
    fullDetails: {splitterDetails: [connection, next]},
  });
  expect(
    cards
      .filter(card => card.kind === 'customer')
      .map(card => card.data.customerName),
  ).toEqual(['API Customer A', 'API Customer B']);
  expect(cards.filter(card => card.kind === 'splitter')).toHaveLength(3);
});
test('renders zero optical power and API core color without substituting screenshot examples', () => {
  const view = renderer.create(
    <CustomerConnectivityCards
      items={[
        {
          infraType: 'Splitter',
          splitterName: 'S1',
          inputPower: 0,
          outputPower: -14,
        },
        {
          infraType: 'Customer',
          customerName: 'C1',
          tube: 0,
          core1: 2,
          core1Color: 'Blue',
        },
      ]}
      circuit={null}
    />,
  );
  const texts = view.root.findAllByType(Text).map(node => node.props.children);
  expect(texts).toContain('In = 0 dBm | Out = -14 dBm');
  expect(texts).toContain('0');
  expect(texts).toContain('Blue');
  view.unmount();
});

test('customer chain starts at its own splitter and steps upstream one connection at a time', () => {
  const {
    customerSplitterView,
  } = require('../src/screens/InfraConnectivityScreen/customerSplitterChain');
  const cards = customerCardsOf([], {
    fullDetails: {
      splitterDetails: [
        {
          id: 20,
          splitterId: 5,
          splitterCode: 'S5',
          parentId: 55,
          customerName: 'Customer A',
        },
        {id: 21, splitterId: 55, splitterCode: 'S55', parentId: 70},
        {id: 22, splitterId: 70, splitterCode: 'S70', parentId: 0},
        {id: 23, splitterId: 99, splitterCode: 'Unrelated', parentId: 0},
      ],
    },
  });
  const initial = customerSplitterView(cards, 0, 0);
  expect(
    initial.cards.map((card: any) => [card.kind, card.data.splitterId]),
  ).toEqual([
    ['splitter', 5],
    ['customer', 5],
  ]);
  expect(
    customerSplitterView(cards, 0, 1).cards.map(
      (card: any) => card.data.splitterId,
    ),
  ).toEqual([55, 5, 5]);
  const last = customerSplitterView(cards, 0, 2);
  expect(last.cards.map((card: any) => card.data.splitterId)).toEqual([
    70, 55, 5,
  ]);
  expect(last.cards.find((card: any) => card.kind === 'customer')).toBe(
    initial.cards.find((card: any) => card.kind === 'customer'),
  );
  expect(last.hasPrevious).toBe(false);
});
test('missing parent metadata uses only its real API ID and a cyclic chain safely terminates', () => {
  const {
    customerSplitterView,
  } = require('../src/screens/InfraConnectivityScreen/customerSplitterChain');
  const missing = customerSplitterView(
    customerCardsOf([], {fullDetails: {splitterDetails: [connection]}}),
    0,
    1,
  );
  expect(missing.cards[0].data).toEqual({
    splitterId: 55,
    detailsUnavailable: true,
  });
  expect(missing.hasPrevious).toBe(false);
  const cyclic = customerSplitterView(
    customerCardsOf([], {
      fullDetails: {
        splitterDetails: [
          {splitterId: 5, splitterCode: 'S5', parentId: 55, customerName: 'A'},
          {splitterId: 55, splitterCode: 'S55', parentId: 5},
        ],
      },
    }),
    0,
    1,
  );
  expect(cyclic.cards.map((card: any) => card.data.splitterId)).toEqual([
    55, 5, 5,
  ]);
  expect(cyclic.hasPrevious).toBe(false);
});

test('enriches a customer splitter leg from the physical record returned by the circuit API', () => {
  const {
    customerSplitterView,
  } = require('../src/screens/InfraConnectivityScreen/customerSplitterChain');
  const physical = {
    id: 55,
    splitterId: 5,
    parentId: 54,
    splitterCode: 'Physical-SPL-5',
    splitterLaymenCode: 'API splitter name',
    splitterType: '1:32',
    address: 'API splitter address',
    landmark: 'API splitter landmark',
    masterCode: 'BLD-21',
    customerName: '',
    customerMobileNo: '',
    customerAddress: '',
    customerLatLng: '',
  };
  const leg = {
    ...connection,
    id: 1706,
    parentId: 55,
    splitterType: '',
    address: '',
    splitterLaymenCode: '',
  };
  const cards = customerCardsOf(details, {
    fullDetails: {details, splitterDetails: [physical, leg]},
  });
  const first = customerSplitterView(cards, 0, 0);
  expect(
    first.cards.filter((card: any) => card.kind === 'splitter'),
  ).toHaveLength(1);
  expect(first.cards[0].data).toEqual(
    expect.objectContaining({
      splitterId: 5,
      splitterType: '1:32',
      address: 'API splitter address',
      landmark: 'API splitter landmark',
      splitterLaymenCode: 'API splitter name',
    }),
  );
  const view = renderer.create(
    <CustomerConnectivityCards
      items={details}
      circuit={null}
      cards={first.cards}
    />,
  );
  const texts = view.root.findAllByType(Text).map(node => node.props.children);
  expect(texts).toEqual(
    expect.arrayContaining([
      'API splitter name',
      '1:32',
      'API splitter address',
      'API splitter landmark',
      'API Customer A',
    ]),
  );
  view.unmount();
  const previous = customerSplitterView(cards, 0, 1);
  expect(previous.cards[0].data).toEqual({
    splitterId: 54,
    detailsUnavailable: true,
  });
  expect(
    previous.cards.filter((card: any) => card.kind === 'splitter'),
  ).toHaveLength(2);
});
test('latest splitter-specific API values override older generic detail metadata', () => {
  const cards = customerCardsOf(
    [
      {
        infraType: 'Splitter',
        splitterId: 5,
        splitterCode: 'S5',
        address: 'Old address',
        splitterType: '1:4',
      },
    ],
    {
      fullDetails: {
        splitterDetails: [
          {
            id: 55,
            splitterId: 5,
            splitterCode: 'S5',
            address: 'Current API address',
            splitterType: '1:32',
            splitterName: 'Current API name',
          },
        ],
      },
    },
  );
  expect(cards.find(card => card.kind === 'splitter')?.data).toEqual(
    expect.objectContaining({
      address: 'Current API address',
      splitterType: '1:32',
      splitterName: 'Current API name',
    }),
  );
});

test('only previous splitter cards use splitParentLeg with the static 1: prefix', () => {
  const view = renderer.create(
    <CustomerConnectivityCards
      items={[]}
      circuit={{}}
      cards={[
        {
          kind: 'splitter',
          data: {splitterId: 7, splitterType: '1:8', splitParentLeg: 16},
        },
        {
          kind: 'splitter',
          previous: true,
          data: {splitterId: 6, splitterType: '1:4', splitParentLeg: 32},
        },
      ]}
    />,
  );
  const texts = view.root.findAllByType(Text).map(node => node.props.children);
  expect(texts).toContain('1:8');
  expect(texts).toContain('1:32');
  expect(texts).not.toContain('1:4');
  expect(texts).not.toContain('1:16');
});
