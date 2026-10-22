import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {FlatList, Text, TextInput, TouchableOpacity} from 'react-native';
import InfraConnectivityScreen from '../src/screens/InfraConnectivityScreen';
import {getGeoLocation} from '../src/utils/location';
import {circuitConnectivityService} from '../src/services/circuitConnectivityService';

jest.mock('../src/res', () => ({
  FONTS: {},
  IMAGES: {},
  SIZE: {MS: (value: number) => value, MVS: (value: number) => value},
}));
jest.mock('../src/utils/location', () => ({
  checkPermission: jest.fn().mockResolvedValue('granted'),
  getGeoLocation: jest.fn(),
}));
jest.mock('../src/services/circuitConnectivityService', () => ({
  circuitConnectivityService: {
    getCircuitsWithDetails: jest.fn(),
    getPreviousSplitterDetails: jest.fn(),
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock(
  '../src/screens/InfraConnectivityScreen/ConnectivityMap',
  () => require('react-native').View,
);
jest.mock('../src/screens/InfraConnectivityScreen/ConnectivityIcons', () => ({
  HeaderPattern: () => null,
  ConnectivityIcon: () => null,
  MasterMapIcon: () => null,
}));

const request = jest.mocked(circuitConnectivityService.getCircuitsWithDetails);
const getLocation = jest.mocked(getGeoLocation);
let screen: renderer.ReactTestRenderer;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  request.mockResolvedValue({
    success: true,
    status: 200,
    message: '',
    data: [],
    recordsTotal: 0,
    recordsFiltered: 0,
  });
});
afterEach(() => {
  if (screen) {
    act(() => screen.unmount());
  }
  jest.useRealTimers();
});
const mount = async (connectivityType = 'infra') => {
  await act(async () => {
    screen = renderer.create(
      <InfraConnectivityScreen
        navigation={{goBack: jest.fn()}}
        route={{params: {company: {id: 29}, connectivityType}}}
      />,
    );
  });
};
const requestAfterDebounce = async () => {
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
};

const press = async (label: string) => {
  await act(async () => {
    screen.root
      .findAllByType(TouchableOpacity)
      .find(button => button.props.accessibilityLabel === label)!
      .props.onPress();
  });
  await requestAfterDebounce();
};
const typeName = async (text: string, customer = true) => {
  await act(async () => {
    screen.root
      .findAllByType(TextInput)
      .find(
        input =>
          input.props.accessibilityLabel ===
          (customer ? 'Search by customer name' : 'Search infra'),
      )!
      .props.onChangeText(text);
  });
  await requestAfterDebounce();
};

test.each([
  ['infra', 'Infra'],
  ['customer', 'Customer'],
])(
  'initial %s load sends all-data payload without needing location',
  async (mode, circuitType) => {
    await mount(mode);
    await requestAfterDebounce();
    expect(getLocation).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith({
      page: 1,
      size: 10,
      search: '',
      companyId: 29,
      CircuitType: circuitType,
      CustomerSearch: '',
      InfraSearch: '',
      Range: null,
      LatLng: '',
    });
  },
);

test('nearby filter waits for GPS before sending the range and live coordinates', async () => {
  let resolveFix!: (value: any) => void;
  getLocation.mockImplementation(
    () =>
      new Promise(resolve => {
        resolveFix = resolve;
      }),
  );
  await mount('customer');
  await requestAfterDebounce();
  request.mockClear();
  await press('Filter nearby connectivity');
  expect(request).not.toHaveBeenCalled();
  await act(async () => {
    resolveFix({
      coords: {latitude: 28.557578554371236, longitude: 77.24699270396889},
    });
  });
  await requestAfterDebounce();
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      CircuitType: 'Customer',
      Range: 300,
      LatLng: '28.557578554371236, 77.24699270396889',
      CustomerSearch: '',
    }),
  );
});

test('plus activates nearby and subsequent plus/minus requests use the updated range', async () => {
  getLocation.mockResolvedValue({
    coords: {latitude: 28.54, longitude: 77.25},
  } as any);
  await mount();
  await requestAfterDebounce();
  await press('Increase location range by 100 metres');
  await press('Increase location range by 100 metres');
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({Range: 500, LatLng: '28.54, 77.25'}),
  );
  await press('Decrease location range by 100 metres');
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({Range: 400}),
  );
});

test.each([
  ['customer', true, {CustomerSearch: 'AAGN', InfraSearch: ''}],
  ['infra', false, {CustomerSearch: '', InfraSearch: 'AAGN'}],
])(
  'name search on %s bypasses a nearby range miss',
  async (mode, customer, fields) => {
    getLocation.mockResolvedValue({
      coords: {latitude: 28.54, longitude: 77.25},
    } as any);
    await mount(mode);
    await requestAfterDebounce();
    await press('Filter nearby connectivity');
    await typeName(' AAGN ', customer);
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({...fields, Range: null, LatLng: '', search: ''}),
    );
    await press('Clear name search');
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        CustomerSearch: '',
        InfraSearch: '',
        Range: null,
        LatLng: '',
      }),
    );
  },
);

test('name search remains available if nearby GPS fails', async () => {
  getLocation.mockRejectedValue(new Error('Location unavailable'));
  await mount('customer');
  await requestAfterDebounce();
  await press('Filter nearby connectivity');
  request.mockClear();
  await typeName('AAGN');
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({CustomerSearch: 'AAGN', Range: null, LatLng: ''}),
  );
});

test('switching to All removes a previously applied nearby filter', async () => {
  getLocation.mockResolvedValue({
    coords: {latitude: 28.54, longitude: 77.25},
  } as any);
  await mount();
  await requestAfterDebounce();
  await press('Filter nearby connectivity');
  await press('Show all connectivity');
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      Range: null,
      LatLng: '',
      CustomerSearch: '',
      InfraSearch: '',
    }),
  );
});

test.each(['infra', 'customer'])(
  '%s opens with circuit list and only shows connectivity after selecting one',
  async mode => {
    const fixture = (id: number, name: string) => ({
      circuit: {
        id,
        circuitName: `Circuit ${name}`,
        circuitCode: `CIR/${name}`,
        connectivityType: mode === 'customer' ? 'Customer' : 'Infra',
      },
      fullDetails: {
        details: [
          {infraType: 'Switch', deviceId: id, deviceName: `Switch ${name}`},
        ],
        splitterDetails: [
          {
            id: id + 100,
            splitterId: id + 200,
            splitterCode: `Splitter ${name}`,
            customerName: `Customer ${name}`,
          },
        ],
      },
    });
    request.mockResolvedValue({
      success: true,
      status: 200,
      message: '',
      recordsTotal: 2,
      recordsFiltered: 2,
      data: [fixture(1, 'A'), fixture(2, 'B')],
    });
    await mount(mode);
    await requestAfterDebounce();
    const texts = () =>
      screen.root
        .findAllByType(Text)
        .map(text =>
          Array.isArray(text.props.children)
            ? text.props.children.join('')
            : text.props.children,
        );
    expect(texts()).toEqual(
      expect.arrayContaining([
        'Circuit A',
        'Circuit B',
        'CIR/A',
        'CIR/B',
        'Connectivity Type:',
        'Circuit ID:',
      ]),
    );
    expect(texts()).not.toContain('Splitter Information');
    expect(texts()).not.toContain('Switch A');
    expect(texts()).not.toContain('View Map');
    expect(
      screen.root
        .findAllByType(TouchableOpacity)
        .some(button => button.props.accessibilityLabel === 'Choose circuit'),
    ).toBe(false);
    await press('Select circuit Circuit B');
    expect(texts()).toEqual(
      expect.arrayContaining([
        'Circuit Details',
        'Circuit Name:',
        'Circuit B',
        'CIR/B',
        'View Map',
      ]),
    );
    expect(texts()).not.toContain('Circuit A');
    if (mode === 'customer') {
      expect(texts()).toContain('Customer B');
      expect(texts()).not.toContain('Customer A');
    } else {
      expect(texts()).toContain('Switch B');
      expect(texts()).not.toContain('Switch A');
    }
    await press('View map');
    await press('Close map');
    expect(texts()).toContain('Circuit B');
    await press('Back to circuit list');
    expect(texts()).toEqual(expect.arrayContaining(['Circuit A', 'Circuit B']));
    expect(texts()).not.toContain('Splitter Information');
    expect(texts()).not.toContain('Switch B');
    expect(texts()).not.toContain('View Map');
    expect(request).toHaveBeenCalledTimes(1);
  },
);

test('previous splitter updates the same customer screen one link at a time and resets on return', async () => {
  const previousRequest = jest.mocked(
    circuitConnectivityService.getPreviousSplitterDetails,
  );
  previousRequest
    .mockResolvedValueOnce({
      success: true,
      message: '',
      data: [
        {splitterDetailId: 999, splitterId: 55, splitterCode: 'Wrong splitter'},
      ],
    })
    .mockResolvedValueOnce({
      success: true,
      message: '',
      data: [
        {splitterDetailId: 999, splitterId: 99, splitterCode: 'Wrong splitter'},
        {
          splitterDetailId: 55,
          splitterId: 55,
          splitterCode: 'S55',
          parentId: 70,
        },
      ],
    })
    .mockResolvedValueOnce({
      success: true,
      message: '',
      data: {
        splitterDetails: [
          {
            splitterDetailId: 70,
            splitterId: 70,
            splitterCode: 'S70',
            parentId: 0,
          },
        ],
      },
    });
  request.mockResolvedValue({
    success: true,
    status: 200,
    message: '',
    recordsTotal: 1,
    recordsFiltered: 1,
    data: [
      {
        circuit: {
          id: 1,
          circuitName: 'Customer circuit',
          circuitCode: 'CIR/Cust/1',
        },
        fullDetails: {
          details: [
            {
              infraType: 'Splitter',
              splitterId: 5,
              splitterCode: 'S5',
              splitterLaymenCode: 'SPL-7- L4 - N1/1',
            },
          ],
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
          ],
        },
      },
    ],
  });
  await mount('customer');
  await requestAfterDebounce();
  await press('Select circuit Customer circuit');
  const texts = () =>
    screen.root.findAllByType(Text).map(text => text.props.children);
  expect(texts().filter(text => text === 'Splitter Information')).toHaveLength(
    1,
  );
  expect(texts()).toContain('Customer Information');
  expect(texts()).not.toContain('S55');
  await press('View previous splitter');
  expect(previousRequest).toHaveBeenNthCalledWith(1, 5, 'S5', false);
  expect(texts().filter(text => text === 'Splitter Information')).toHaveLength(
    1,
  );
  expect(texts()).toContain('Customer A');
  expect(texts()).not.toContain('Wrong splitter');
  expect(texts()).toContain(
    'No previous splitter matched this splitter’s parent ID.',
  );
  await press('View previous splitter');
  expect(previousRequest).toHaveBeenNthCalledWith(2, 5, 'S5', false);
  expect(texts().filter(text => text === 'Splitter Information')).toHaveLength(
    2,
  );
  expect(texts()).toEqual(expect.arrayContaining(['S55', 'S5']));
  expect(texts()).toContain('Customer Information');
  expect(texts()).toContain('Customer A');
  await press('View previous splitter');
  expect(previousRequest).toHaveBeenNthCalledWith(3, 55, 'S55', false);
  expect(texts().filter(text => text === 'Splitter Information')).toHaveLength(
    3,
  );
  expect(texts()).toEqual(
    expect.arrayContaining(['S70', 'S55', 'S5', 'Customer A']),
  );
  expect(texts().indexOf('S70')).toBeLessThan(texts().indexOf('S55'));
  expect(texts().indexOf('S55')).toBeLessThan(texts().indexOf('S5'));
  expect(texts().indexOf('S5')).toBeLessThan(texts().indexOf('Customer A'));
  const previousButtons = screen.root
    .findAllByType(TouchableOpacity)
    .filter(
      button => button.props.accessibilityLabel === 'View previous splitter',
    );
  expect(previousButtons).toHaveLength(1);
  expect(previousButtons[0].props.disabled).toBe(true);
  expect(
    screen.root
      .findAllByType(TouchableOpacity)
      .some(button => /forward/i.test(button.props.accessibilityLabel || '')),
  ).toBe(false);
  expect(previousRequest).toHaveBeenCalledTimes(3);
  await press('Return to customer connection');
  expect(texts().filter(text => text === 'Splitter Information')).toHaveLength(
    1,
  );
  expect(texts()).toContain('Customer Information');
});

const pageCircuits = (first: number, count: number) =>
  Array.from({length: count}, (_, index) => ({
    circuit: {
      id: first + index,
      circuitName: `Circuit ${first + index}`,
      circuitCode: `CIR/${first + index}`,
    },
    fullDetails: {details: []},
  }));
const pageResponse = (data: any[], total: number) => ({
  success: true,
  status: 200,
  message: '',
  data,
  recordsTotal: total,
  recordsFiltered: total,
});
const listData = () => screen.root.findByType(FlatList).props.data;
const scrollToEnd = async () => {
  await act(async () => {
    await screen.root.findByType(FlatList).props.onEndReached();
  });
};

test.each([
  [10, 10],
  [10, 0],
  [3, 30],
])(
  'hides load more for %i returned circuits with a filtered count of %i',
  async (count, total) => {
    request.mockResolvedValue(pageResponse(pageCircuits(1, count), total));
    await mount();
    await requestAfterDebounce();
    expect(
      screen.root
        .findAllByType(TouchableOpacity)
        .some(
          button => button.props.accessibilityLabel === 'Load more circuits',
        ),
    ).toBe(false);
    await scrollToEnd();
    expect(request).toHaveBeenCalledTimes(1);
  },
);

test.each(['infra', 'customer'])(
  '%s circuit pagination loads on demand, deduplicates, and stops at the last page',
  async mode => {
    request.mockImplementation(async payload =>
      pageResponse(
        payload.page === 1
          ? pageCircuits(1, 10)
          : payload.page === 2
          ? pageCircuits(10, 10)
          : pageCircuits(20, 2),
        21,
      ),
    );
    await mount(mode);
    await requestAfterDebounce();
    expect(request).toHaveBeenCalledTimes(1);
    expect(listData()).toHaveLength(10);
    expect(
      screen.root
        .findAllByType(TouchableOpacity)
        .some(
          button => button.props.accessibilityLabel === 'Load more circuits',
        ),
    ).toBe(true);
    await scrollToEnd();
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 2,
        size: 10,
        CircuitType: mode === 'customer' ? 'Customer' : 'Infra',
        companyId: 29,
      }),
    );
    expect(listData()).toHaveLength(19);
    await scrollToEnd();
    expect(listData()).toHaveLength(21);
    expect(new Set(listData().map((item: any) => item.circuitCode)).size).toBe(
      21,
    );
    await scrollToEnd();
    expect(request).toHaveBeenCalledTimes(3);
    expect(
      screen.root
        .findAllByType(TouchableOpacity)
        .some(
          button => button.props.accessibilityLabel === 'Load more circuits',
        ),
    ).toBe(false);
  },
);

test('pagination failure preserves loaded rows and retries the same page', async () => {
  request
    .mockResolvedValueOnce(pageResponse(pageCircuits(1, 10), 13))
    .mockResolvedValueOnce({
      ...pageResponse([], 13),
      success: false,
      message: 'Page unavailable',
    })
    .mockResolvedValueOnce(pageResponse(pageCircuits(11, 3), 13));
  await mount();
  await requestAfterDebounce();
  await scrollToEnd();
  expect(listData()).toHaveLength(10);
  await scrollToEnd();
  expect(request).toHaveBeenCalledTimes(2);
  await press('Retry loading more circuits');
  expect(request.mock.calls.map(([payload]) => payload.page)).toEqual([
    1, 2, 2,
  ]);
  expect(listData()).toHaveLength(13);
});

test('repeated end events use a single request and a pending old page cannot pollute a new search', async () => {
  let resolvePage!: (value: any) => void;
  request
    .mockResolvedValueOnce(pageResponse(pageCircuits(1, 10), 30))
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolvePage = resolve;
        }),
    )
    .mockResolvedValueOnce(pageResponse(pageCircuits(99, 1), 1));
  await mount('customer');
  await requestAfterDebounce();
  await act(async () => {
    const onEnd = screen.root.findByType(FlatList).props.onEndReached;
    onEnd();
    onEnd();
  });
  expect(request).toHaveBeenCalledTimes(2);
  await typeName('AAGN');
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      page: 1,
      CustomerSearch: 'AAGN',
      Range: null,
      LatLng: '',
    }),
  );
  await act(async () => {
    resolvePage(pageResponse(pageCircuits(11, 10), 30));
  });
  expect(listData().map((item: any) => item.circuitCode)).toEqual(['CIR/99']);
});

test('later pages preserve name filters and do not load while a circuit detail is open', async () => {
  request
    .mockResolvedValueOnce(pageResponse([], 0))
    .mockResolvedValueOnce(pageResponse(pageCircuits(1, 10), 12))
    .mockResolvedValueOnce(pageResponse(pageCircuits(11, 2), 12));
  await mount('customer');
  await requestAfterDebounce();
  await typeName('AAGN');
  await press('Select circuit Circuit 1');
  await scrollToEnd();
  expect(request).toHaveBeenCalledTimes(2);
  await press('Back to circuit list');
  await scrollToEnd();
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      page: 2,
      CustomerSearch: 'AAGN',
      InfraSearch: '',
      Range: null,
      LatLng: '',
    }),
  );
  expect(listData()).toHaveLength(12);
});

test('previous splitter sends the physical splitterCode, never the customer leg display code', async () => {
  const actualCode = '086/2960/A-128/B-64-2/C-32-1/D-4-1';
  const displayCode = 'SPL-7- L4 - N1';
  const previousRequest = jest.mocked(
    circuitConnectivityService.getPreviousSplitterDetails,
  );
  request.mockResolvedValue(
    pageResponse(
      [
        {
          circuit: {id: 7, circuitName: 'Code regression'},
          fullDetails: {
            details: [
              {infraType: 'Splitter', splitterId: 7, splitterCode: displayCode},
            ],
            splitterDetails: [
              {
                id: 200,
                splitterId: 7,
                splitterCode: displayCode,
                parentId: 100,
                customerName: 'Code customer',
              },
              {
                id: 100,
                splitterId: 7,
                splitterCode: actualCode,
                splitterLaymenCode: displayCode,
                parentId: 88,
              },
            ],
          },
        },
      ],
      1,
    ),
  );
  previousRequest.mockResolvedValueOnce({
    success: true,
    message: '',
    data: [
      {
        splitterDetailId: 88,
        splitterId: 6,
        splitterCode: 'Upstream code',
        parentId: 0,
      },
      {
        splitterDetailId: 100,
        splitterId: 7,
        splitterCode: 'Wrong parent match',
      },
    ],
  });
  await mount('customer');
  await requestAfterDebounce();
  await press('Select circuit Code regression');
  await press('View previous splitter');
  expect(previousRequest).toHaveBeenCalledWith(7, actualCode, false);
  expect(previousRequest).not.toHaveBeenCalledWith(7, displayCode, false);
  const texts = screen.root
    .findAllByType(Text)
    .map(text => text.props.children);
  expect(texts).toContain('Upstream code');
  expect(texts).toContain('Code customer');
  expect(texts).not.toContain('Wrong parent match');
});
