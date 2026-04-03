import React, {FC, useCallback, useState, useRef, useEffect} from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {Screen} from '@organisms';
import styles from './styles';
import {BackHeader} from '@molecules';
import {MasterFormModal} from '../../components/molecules/MasterFormModal';
import {ScreenProps, DataType} from '@types';
import {COLORS, IMAGES, FONTS, SIZE} from '@res';
import LinearGradient from 'react-native-linear-gradient';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import {Location, Common} from '@utils';
import {parseAddressComponents} from '../../components/molecules/addressParser';
import {RootState, StoreDispatch} from '@reducers';
import {UpdateMasterAPI, GetMasterByNameAPI} from '@slices/route.slice';
import {addRouteAPI} from '@slices/route.slice';
import {
  createInitialRouteAPI,
  updateRoutePathDetailsAPI,
  insertUpdateRouteChamberMappingAPI, // ✅ NEW IMPORT
} from '@slices/route.slice';
import {
  Padding,
  Border,
  Gap,
  FontFamily,
  FontSize,
  LineHeight,
  Height,
} from '../../res/globalStyle';
import {launchCamera, CameraOptions} from 'react-native-image-picker';
import {useDispatch} from 'react-redux';
import {PERMISSIONS, check, request, RESULTS} from 'react-native-permissions';

type RouteItem = {
  id: string;
  label: string;
  value: string;
  icon: any;
  status: 'idle' | 'started' | 'paused';
  completed: boolean;
  distance?: number;
  images: string[];
  masterData: any;
  name: string;
  address: string;
  apiImage?: string;
  latitude?: number;
  longitude?: number;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

type RouteSegment = {
  itemId: string;
  coords: Coordinate[];
};

const DashedLineVertical = () => {
  return (
    <View style={routeStyles.dashedLineVerticalWrapper}>
      {Array.from({length: 8}).map((_, i) => (
        <View key={i} style={routeStyles.dashedSegment} />
      ))}
    </View>
  );
};

const DashedLineHorizontal = () => {
  return (
    <View style={routeStyles.dashedLineHorizontalWrapper}>
      {Array.from({length: 5}).map((_, i) => (
        <View key={i} style={routeStyles.dashedSegmentHorizontal} />
      ))}
    </View>
  );
};

const AddRouteScreen: FC<ScreenProps.AddRouteScreen> = ({navigation}) => {
  const dispatch = useDispatch<StoreDispatch>();
  const [routeName, setRouteName] = useState('');
  const [savedRouteName, setSavedRouteName] = useState('');
  const [isRouteAdded, setIsRouteAdded] = useState(false);
  const [selectedType, setSelectedType] = useState<any>(null);
  const [fullRouteCoords, setFullRouteCoords] = useState<Coordinate[]>([]);
  const mapRef = useRef<MapView>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [address, setAddress] = useState('');
  const [addedItems, setAddedItems] = useState<RouteItem[]>([]);
  const completedCount = addedItems.filter(item => item.completed).length;
  const [isTracking, setIsTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(
    null,
  );
  const [isRouteActive, setIsRouteActive] = useState(false);
  const [initialRegion, setInitialRegion] = useState({
    latitude: 28.5355,
    longitude: 77.391,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // Live coords for the current tracking segment only
  const [livePolylineCoords, setLivePolylineCoords] = useState<Coordinate[]>(
    [],
  );
  // ✅ Ref to always hold latest livePolylineCoords synchronously
  const livePolyCoordsRef = useRef<Coordinate[]>([]);

  // Completed segments — persist on map after each stop
  const [completedSegments, setCompletedSegments] = useState<RouteSegment[]>(
    [],
  );
  const [polylineCoords, setPolylineCoords] = useState<Coordinate[]>([]);
  const [travelledDistance, setTravelledDistance] = useState(0);
  const travelledDistanceRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<Coordinate | null>(null);
  const trackingIntervalRef = useRef<any>(null);
  const currentTrackingItemIdRef = useRef<string | null>(null);
  const lastSegmentEndCoordRef = useRef<Coordinate | null>(null);

  // Store the routeId returned from createInitialRouteAPI
  const initialRouteIdRef = useRef<number>(0);

  const [masterList, setMasterList] = useState<any[]>([]);
  const [isLoadingMasters, setIsLoadingMasters] = useState(false);
  const [existingvisible, setExistingvisible] = useState(false);
  const [addMasterModalVisible, setAddMasterModalVisible] = useState(false);
  const [mastervisible, setMastervisible] = useState(false);
  const [masterName, setMasterName] = useState('');
  const [latLngText, setLatLngText] = useState('');
  const [masterAddress, setMasterAddress] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [country, setCountry] = useState('');
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [extra1, setExtra1] = useState('');
  const [extra2, setExtra2] = useState('');
  const [image1, setImage1] = useState<string>('');
  const [image2, setImage2] = useState<string>('');
  const [isRouteStopped, setIsRouteStopped] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const pickerData = [
    {label: 'Pole', value: 'Pole', icon: IMAGES.PoleImage},
    {label: 'Enclosure', value: 'Enclosure', icon: IMAGES.jointEnclosure},
    {label: 'Tiffin', value: 'Tiffin', icon: IMAGES.TiffinIcon},
    {label: 'Tree', value: 'Tree', icon: IMAGES.treeIcon},
    {label: 'Building', value: 'Building', icon: IMAGES.TiffinIcon},
  ];

  const getTotalDistance = (): number => {
    return addedItems
      .filter(item => item.completed && item.distance)
      .reduce((sum, item) => sum + (item.distance || 0), 0);
  };

  const getAddressLocation = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setLocationError('');
      const permissionStatus = await Location.checkPermission();
      if (permissionStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to fetch address.',
          [{text: 'OK'}],
        );
        return;
      }
      const data = (await Location.getAddressFromLatLong(
        forceRefresh,
      )) as DataType.GeoAddress;
      if (data?.address) {
        setAddress(data.address);
      } else {
        setLocationError('Unable to fetch address');
      }
    } catch (e: any) {
      setLocationError(e?.message || 'Location error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRoute = async () => {
    try {
      if (!savedRouteName) {
        Alert.alert('Error', 'Route name is required');
        return;
      }
      if (addedItems.length < 2) {
        Alert.alert('Error', 'Minimum 2 masters required');
        return;
      }
      setIsSubmitting(true);
      const startItem = addedItems[0];
      const endItem = addedItems[addedItems.length - 1];
      const routeLength = Math.round(getTotalDistance());
      let routePath = '';

      const currentPos = lastPositionRef.current ?? currentPosition;
      const startLatLng = startItem.masterData?.latLng || '';
      if (currentPos && startLatLng) {
        const [startLat, startLng] = startLatLng
          .split(',')
          .map((v: string) => v.trim());
        routePath = `LINESTRING(${currentPos.longitude} ${currentPos.latitude}, ${startLng} ${startLat})`;
      } else if (fullRouteCoords.length > 1) {
        const lineStringCoords = fullRouteCoords
          .map(coord => `${coord.longitude} ${coord.latitude}`)
          .join(', ');
        routePath = `LINESTRING(${lineStringCoords})`;
      }
      const routeChamberMappingArray = addedItems.map(item => ({
        id: 0,
        masterId: item.masterData?.id || 0,
        masterType: item.value || '',
        latLng: item.masterData?.latLng || '',
        distance: item.distance || 0,
        address: item.masterData?.address || '',
        selectedAddress: item.masterData?.selectedAddress || '',
        city: item.masterData?.city || '',
        area: item.masterData?.area || '',
        state: item.masterData?.state || '',
        country: item.masterData?.country || '',
        pincode: item.masterData?.pincode || 0,
        landmark: item.masterData?.landmark || '',
        extra1: item.masterData?.extra1 || '',
        extra2: item.masterData?.extra2 || '',
      }));
      const payload = {
        Id: 0,
        RouteId: '0',
        RouteName: savedRouteName,
        RouteLength: routeLength,
        StartAddress: startItem.masterData?.address || '',
        StartCity: startItem.masterData?.city || '',
        StartState: startItem.masterData?.state || '',
        StartCountry: startItem.masterData?.country || '',
        StartArea: startItem.masterData?.area || '',
        StartPincode: startItem.masterData?.pincode || 0,
        StartLandmark: startItem.masterData?.landmark || '',
        StartLatLng: startItem.masterData?.latLng || '',
        EndAddress: endItem.masterData?.address || '',
        EndCity: endItem.masterData?.city || '',
        EndState: endItem.masterData?.state || '',
        EndCountry: endItem.masterData?.country || '',
        EndArea: endItem.masterData?.area || '',
        EndPincode: endItem.masterData?.pincode || 0,
        EndLandmark: endItem.masterData?.landmark || '',
        EndLatLng: endItem.masterData?.latLng || '',
        RoutePath: routePath,
        RouteChamberMappingVM: routeChamberMappingArray,
      };

      console.log('📤 FINAL PAYLOAD:', JSON.stringify(payload, null, 2));
      await dispatch(addRouteAPI(payload)).unwrap();
      Common.showToast('Route Added Successfully ✅');
      navigation.goBack();
    } catch (error: any) {
      console.log('❌ Route Save Error:', error);
      Alert.alert('Error', error?.message || 'Failed to save route');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      const permission =
        Platform.OS === 'android'
          ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
          : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
      let result = await check(permission);
      if (result === RESULTS.GRANTED) return true;
      if (result === RESULTS.BLOCKED || result === RESULTS.LIMITED) {
        Alert.alert(
          'Location Permission Required',
          'Please enable location permission in settings.',
        );
        return false;
      }
      if (result === RESULTS.DENIED || result === RESULTS.UNAVAILABLE) {
        result = await request(permission);
        return result === RESULTS.GRANTED;
      }
      return false;
    } catch (error) {
      console.error('⚠️ Permission error:', error);
      return false;
    }
  };

  useEffect(() => {
    const getInitialLocation = async () => {
      try {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) return;
        Geolocation.getCurrentPosition(
          position => {
            const {latitude, longitude} = position.coords;
            const newPosition = {latitude, longitude};
            setCurrentPosition(newPosition);
            lastPositionRef.current = newPosition;
            setInitialRegion({
              latitude,
              longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
            setTimeout(() => {
              mapRef.current?.animateToRegion(
                {
                  latitude,
                  longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                },
                1000,
              );
            }, 500);
          },
          () => {
            Geolocation.getCurrentPosition(
              position => {
                const {latitude, longitude} = position.coords;
                setCurrentPosition({latitude, longitude});
                lastPositionRef.current = {latitude, longitude};
                setInitialRegion({
                  latitude,
                  longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                });
                mapRef.current?.animateToRegion(
                  {
                    latitude,
                    longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  },
                  1000,
                );
              },
              () => {},
              {enableHighAccuracy: false, timeout: 30000, maximumAge: 60000},
            );
          },
          {enableHighAccuracy: true, timeout: 20000, maximumAge: 10000},
        );
      } catch (error) {
        console.error('⚠️ Setup error:', error);
      }
    };
    getInitialLocation();
  }, []);

  useEffect(() => {
    getAddressLocation();
  }, []);

  const calculateDistance = (
    coord1: Coordinate,
    coord2: Coordinate,
  ): number => {
    const R = 6371e3;
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };
  // ✅ Called on Start of EVERY item — creates/updates the route record and saves routeId
  const callCreateInitialRoute = async (item: RouteItem, orderNo: number) => {
    const masterLatLng = item.masterData?.latLng || '';

    if (!masterLatLng) {
      throw new Error('Master LatLng not available');
    }

    const [masterLat, masterLng] = masterLatLng
      .split(',')
      .map((v: string) => v.trim());

    if (!masterLat || !masterLng) {
      throw new Error('Invalid master LatLng format');
    }

    // ✅ CURRENT USER LOCATION (LIVE GPS)
    const currentPos = lastPositionRef.current ?? currentPosition;

    if (!currentPos) {
      throw new Error('Current location not available');
    }

    const userLat = currentPos.latitude;
    const userLng = currentPos.longitude;

    // 🔥 FINAL LINESTRING (FIRST USER → THEN MASTER)
    const routePath = `LINESTRING(${userLng} ${userLat},${masterLng} ${masterLat})`;

    const payload = {
      id: initialRouteIdRef.current || 0,
      routeName: savedRouteName,

      startLatLng: masterLatLng,
      startAddress: item.masterData?.address || '',
      startLandmark: item.masterData?.landmark || '',
      startArea: item.masterData?.area || '',
      startCity: item.masterData?.city || '',
      startState: item.masterData?.state || '',
      startPincode: item.masterData?.pincode || 0,
      startCountry: item.masterData?.country || '',

      masterType: item.value,
      masterId: item.masterData?.id,
      orderNo,

      routePath, // ✅ FIXED
    };

    console.log('🚀 Initial Route Payload:', JSON.stringify(payload, null, 2));

    const result = await dispatch(createInitialRouteAPI(payload)).unwrap();

    if (result?.id) {
      initialRouteIdRef.current = result.id;
      console.log('🆔 RouteId Stored:', result.id);
    }
  };

  // ✅ NEW: Called on Start of 2nd item onwards (index > 0)
  //   Maps this master to the existing route using the stored routeId
  const callInsertUpdateChamberMapping = async (
    previousItem: RouteItem, // 👈 NOTE: previous master
    currentItem: RouteItem, // 👈 current master (jahan Start dabaya)
    orderNo: number,
  ) => {
    const routeId = initialRouteIdRef.current;
    if (!routeId) {
      throw new Error('Route not initialized. Start first master.');
    }
    const segmentDistance = previousItem.distance || 0;
    const payload = {
      id: 0,
      routeId,
      masterType: previousItem.value || '',
      masterId: previousItem.masterData?.id || 0,
      // ✅ THIS IS THE IMPORTANT FIX
      distance: segmentDistance,
      // ✅ Current master is END point
      endLatLng: currentItem.masterData?.latLng || '',
      endAddress: currentItem.masterData?.address || '',
      endLandmark: currentItem.masterData?.landmark || '',
      endArea: currentItem.masterData?.area || '',
      endCity: currentItem.masterData?.city || '',
      endState: currentItem.masterData?.state || '',
      endPincode: currentItem.masterData?.pincode || 0,
      endCountry: currentItem.masterData?.country || '',
      routeLength: getTotalDistance(),
      orderNo,
    };
    console.log('📤 Chamber Mapping Payload:', payload);
    await dispatch(insertUpdateRouteChamberMappingAPI(payload)).unwrap();
    console.log(
      `✅ Mapping Sent | ${previousItem.name} → ${currentItem.name} | Distance: ${segmentDistance}m`,
    );
  };
  const startTracking = useCallback(async (itemId: string) => {
    if (trackingIntervalRef.current !== null) {
      console.log('⚠️ Already tracking');
      return;
    }
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Location permission needed.');
      return;
    }
    console.log('🚀 Starting tracking for item:', itemId);
    setIsTracking(true);
    const prevEndCoord = lastSegmentEndCoordRef.current;
    const initialLiveCoords = prevEndCoord ? [prevEndCoord] : [];
    livePolyCoordsRef.current = initialLiveCoords;
    setLivePolylineCoords(initialLiveCoords);
    setPolylineCoords([]);
    travelledDistanceRef.current = 0;
    setTravelledDistance(0);
    currentTrackingItemIdRef.current = itemId;
    const getPosition = (): Promise<Coordinate> => {
      return new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(
          position =>
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          () => {
            Geolocation.getCurrentPosition(
              position =>
                resolve({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                }),
              err => reject(err),
              {enableHighAccuracy: false, timeout: 20000, maximumAge: 5000},
            );
          },
          {enableHighAccuracy: true, timeout: 15000, maximumAge: 1000},
        );
      });
    };

    try {
      const initialCoord = await getPosition();
      console.log('🎯 Tracking started at:', initialCoord);
      setCurrentPosition(initialCoord);
      lastPositionRef.current = initialCoord;

      // ✅ Update both state and ref together
      livePolyCoordsRef.current = [...livePolyCoordsRef.current, initialCoord];
      setLivePolylineCoords(prev => {
        const updated = [...prev, initialCoord];
        livePolyCoordsRef.current = updated;
        return updated;
      });
      setPolylineCoords([initialCoord]);
      setFullRouteCoords(prev => [...prev, initialCoord]);

      mapRef.current?.animateToRegion(
        {
          latitude: initialCoord.latitude,
          longitude: initialCoord.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500,
      );

      trackingIntervalRef.current = setInterval(async () => {
        try {
          const newCoord = await getPosition();
          setCurrentPosition(newCoord);
          if (lastPositionRef.current) {
            const distance = calculateDistance(
              lastPositionRef.current,
              newCoord,
            );
            if (distance >= 8) {
              console.log('📏 Moved:', distance.toFixed(2), 'm');
              travelledDistanceRef.current += distance;
              setTravelledDistance(prev => {
                const updated = prev + distance;
                travelledDistanceRef.current = updated;
                return updated;
              });
              // ✅ Update both state and ref together
              setLivePolylineCoords(prev => {
                const updated = [...prev, newCoord];
                livePolyCoordsRef.current = updated;
                return updated;
              });
              setPolylineCoords(prev => [...prev, newCoord]);
              setFullRouteCoords(prev => [...prev, newCoord]);
              lastPositionRef.current = newCoord;
              mapRef.current?.animateToRegion(
                {
                  latitude: newCoord.latitude,
                  longitude: newCoord.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                },
                300,
              );
            }
          } else {
            lastPositionRef.current = newCoord;
          }
        } catch (error) {
          console.log('⚠️ Position update failed, will retry...');
        }
      }, 3000);

      console.log('✅ Tracking interval started');
    } catch (error: any) {
      console.error('❌ Failed to start:', error);
      setIsTracking(false);
      Alert.alert('Unable to Start', 'Please ensure GPS is enabled.');
    }
  }, []);

  const stopTracking = useCallback(() => {
    console.log('🛑 Stopping tracking');
    if (trackingIntervalRef.current !== null) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (trackingIntervalRef.current !== null) {
        clearInterval(trackingIntervalRef.current);
      }
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const trimToWords = (text: string, wordLimit: number) => {
    if (!text) return '';
    const words = text.trim().replace(/\s+/g, ' ').split(' ');
    if (words.length <= wordLimit) return text;
    return words.slice(0, wordLimit).join(' ') + '...';
  };

  const hasActiveItem = addedItems.some(
    item => item.status === 'started' || item.status === 'paused',
  );

  const shouldShowEndRouteButton = completedCount >= 2 && !hasActiveItem;

  const handleBackPress = useCallback(() => {
    if (isTracking) {
      Alert.alert('Tracking Active', 'Stop tracking?', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Stop & Go Back',
          onPress: () => {
            stopTracking();
            navigation.goBack();
          },
        },
      ]);
    } else {
      navigation.goBack();
    }
  }, [navigation, isTracking, stopTracking]);

  const handleAddRoute = () => {
    if (!routeName.trim()) {
      Alert.alert('Error', 'Please enter route name');
      return;
    }
    setSavedRouteName(routeName.trim());
    setIsRouteAdded(true);
  };

  const handleCheckboxSelect = (item: any) => {
    setSelectedType(item);
    fetchMasterList(item.value);
  };

  const fetchMasterList = async (masterType: string) => {
    try {
      setIsLoadingMasters(true);
      setMasterList([]);
      const response = await dispatch(
        GetMasterByNameAPI({name: masterType}),
      ).unwrap();
      if (response?.data && Array.isArray(response.data)) {
        setMasterList(response.data);
      } else if (Array.isArray(response)) {
        setMasterList(response);
      } else {
        setMasterList([]);
      }
    } catch (error) {
      console.error('❌ Error fetching masters:', error);
      setMasterList([]);
    } finally {
      setIsLoadingMasters(false);
    }
  };

  const handleExistingClick = async () => {
    if (!selectedType) {
      Alert.alert('No Selection', 'Please select a master type first');
      return;
    }
    try {
      setIsLoadingMasters(true);
      const response = await dispatch(
        GetMasterByNameAPI({name: selectedType.value}),
      ).unwrap();
      const data =
        response?.data && Array.isArray(response.data)
          ? response.data
          : Array.isArray(response)
          ? response
          : [];
      if (data.length === 0) {
        Alert.alert('No Data', `No ${selectedType.label} found`);
        return;
      }
      setMasterList(data);
      setExistingvisible(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch data');
    } finally {
      setIsLoadingMasters(false);
    }
  };

  const handleMasterSelect = (master: any) => {
    if (!selectedType) return;
    const fullAddress = [
      master.address,
      master.area,
      master.city,
      master.state,
      master.pincode,
    ]
      .filter(Boolean)
      .join(', ');
    let lat: number | undefined, lng: number | undefined;
    if (master.latLng) {
      const [latStr, lngStr] = master.latLng.split(',');
      lat = parseFloat(latStr?.trim());
      lng = parseFloat(lngStr?.trim());
    }
    const newItem: RouteItem = {
      id: Date.now().toString(),
      label: selectedType.label,
      value: selectedType.value,
      icon: selectedType.icon,
      status: 'idle',
      completed: false,
      images: [],
      masterData: master,
      name: master.name || 'Unknown',
      address: fullAddress,
      apiImage: master.image1 || master.imageUrl || master.image || '',
      latitude: lat,
      longitude: lng,
    };
    setAddedItems(prev => [...prev, newItem]);
    setExistingvisible(false);
    setAddMasterModalVisible(false);
    setSelectedType(null);
    if (lat && lng) {
      setTimeout(() => {
        mapRef.current?.animateToRegion(
          {
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          1000,
        );
      }, 300);
    }
  };

  const handleOpenMasterModal = () => {
    setMasterName('');
    setLatLngText('');
    setMasterAddress('');
    setSelectedAddress('');
    setLandmark('');
    setArea('');
    setCity('');
    setStateName('');
    setCountry('');
    setPincode('');
    setExtra1('');
    setExtra2('');
    setImage1('');
    setImage2('');
    setAddressSuggestions([]);
    setMastervisible(true);
  };

  const handleFetchLocation = async () => {
    try {
      setIsFetchingLocation(true);
      const permissionStatus = await Location.checkPermission();
      if (permissionStatus !== 'granted') {
        Alert.alert('Permission Required', 'Location permission needed.');
        return;
      }
      const data: any = await Location.getAddressFromLatLong(true);
      if (data?.lat && data?.long) {
        setLatLngText(`${data.lat}, ${data.long}`);
        setSelectedAddress('');
        setMasterAddress('');
        setArea('');
        setCity('');
        setStateName('');
        setCountry('');
        setPincode('');

        if (data?.suggestions?.length) {
          setAddressSuggestions(data.suggestions);
          setShowAddressDropdown(true);
        }

        Common.showToast('Location fetched! Please select address.');
      } else {
        Alert.alert('Error', 'Unable to fetch coordinates');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to fetch location');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleAddressDropdownToggle = () => {
    if (addressSuggestions.length > 0) {
      setShowAddressDropdown(prev => !prev);
    } else {
      Alert.alert('No Data', 'Please fetch location first');
    }
  };

  const handleAddressSelect = (addr: string) => {
    setSelectedAddress(addr);
    setMasterAddress(addr);

    const parsed = parseAddressComponents(addr);
    if (parsed.area) setArea(parsed.area);
    if (parsed.city) setCity(parsed.city);
    if (parsed.state) setStateName(parsed.state);
    if (parsed.country) setCountry(parsed.country);
    if (parsed.pincode) setPincode(parsed.pincode);

    setShowAddressDropdown(false);
  };

  const handleOpenCamera = (itemId: string) => {
    const item = addedItems.find(i => i.id === itemId);
    if (item && item.images.length >= 1) {
      Alert.alert('Limit Reached', 'Only one image allowed');
      return;
    }
    const options: CameraOptions = {
      mediaType: 'photo',
      cameraType: 'back',
      quality: 0.7,
      saveToPhotos: false,
    };
    launchCamera(options, response => {
      if (response.didCancel || response.errorCode || !response.assets?.length)
        return;
      const uri = response.assets[0].uri;
      if (uri) addImagesToItem(itemId, [uri]);
    });
  };

  const handleOpenCameraForModal = (imageSlot: 1 | 2) => {
    if ((imageSlot === 1 && image1) || (imageSlot === 2 && image2)) {
      Alert.alert('Replace Image', `Replace Image ${imageSlot}?`, [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Replace', onPress: () => openCameraForSlot(imageSlot)},
      ]);
      return;
    }
    openCameraForSlot(imageSlot);
  };

  const openCameraForSlot = (imageSlot: 1 | 2) => {
    const options: CameraOptions = {
      mediaType: 'photo',
      cameraType: 'back',
      quality: 0.7,
      saveToPhotos: false,
    };
    launchCamera(options, response => {
      if (response.didCancel || response.errorCode || !response.assets?.length)
        return;
      const uri = response.assets[0].uri;
      if (uri) {
        if (imageSlot === 1) setImage1(uri);
        else setImage2(uri);
      }
    });
  };

  const addImagesToItem = (id: string, uris: string[]) => {
    setAddedItems(prev =>
      prev.map(item =>
        item.id === id ? {...item, images: [...item.images, ...uris]} : item,
      ),
    );
  };
  const updateItemStatus = async (id: string, status: RouteItem['status']) => {
    if (status === 'started' && !isTracking) {
      const itemIndex = addedItems.findIndex(item => item.id === id);
      if (itemIndex === -1) return;

      const currentItem = addedItems[itemIndex];
      const orderNo = itemIndex + 1;

      try {
        // 🟢 FIRST MASTER → create initial route
        if (itemIndex === 0) {
          await callCreateInitialRoute(currentItem, orderNo);
        }

        // 🔥 FROM SECOND MASTER ONWARDS → chamber mapping
        if (itemIndex > 0) {
          const previousItem = addedItems[itemIndex - 1];
          const routeId = initialRouteIdRef.current;

          if (!routeId) {
            throw new Error('Route not initialized');
          }

          // ✅ Segment distance (ONLY previous segment)
          const segmentDistance = previousItem.distance ?? 0;

          // ✅ Total route length till now (sum of completed segments)
          const totalRouteLength = addedItems
            .filter(i => i.completed)
            .reduce((sum, i) => sum + (i.distance || 0), 0);

          const payload = {
            id: 0,
            routeId,

            // 🔹 FROM (previous master)
            masterType: previousItem.value,
            masterId: previousItem.masterData?.id,
            distance: segmentDistance,

            // 🔹 TO (current master)
            endLatLng: currentItem.masterData?.latLng,
            endAddress: currentItem.masterData?.address,
            endLandmark: currentItem.masterData?.landmark,
            endArea: currentItem.masterData?.area,
            endCity: currentItem.masterData?.city,
            endState: currentItem.masterData?.state,
            endPincode: currentItem.masterData?.pincode,
            endCountry: currentItem.masterData?.country,

            // 🔹 TOTAL ROUTE LENGTH
            routeLength: Math.round(totalRouteLength),

            orderNo,
          };

          console.log(
            '📦 Chamber Mapping Payload:',
            JSON.stringify(payload, null, 2),
          );

          await dispatch(insertUpdateRouteChamberMappingAPI(payload)).unwrap();

          console.log(
            `✅ Mapping Sent | ${previousItem.name} → ${currentItem.name} | Segment: ${segmentDistance}m | Total: ${totalRouteLength}m`,
          );
        }

        // 🚀 Start tracking for current item
        startTracking(id);

        setAddedItems(prev =>
          prev.map(item =>
            item.id === id ? {...item, status: 'started'} : item,
          ),
        );
      } catch (error: any) {
        console.log('❌ Start failed:', error);
        Alert.alert('Error', error?.message || 'Failed to start route');
      }
    }

    if (status === 'paused') {
      setAddedItems(prev =>
        prev.map(item => (item.id === id ? {...item, status: 'paused'} : item)),
      );
    }
  };

  // ✅ Call updateRoutePathDetailsAPI with coords passed directly (no async state issue)
  const callUpdateRoutePath = async (segmentCoords: Coordinate[]) => {
    const routeId = initialRouteIdRef.current;

    if (!routeId) return;

    if (!segmentCoords.length) return;

    const lineStringCoords = segmentCoords
      .map(coord => `${coord.longitude} ${coord.latitude}`)
      .join(', ');

    const routePath = `LINESTRING(${lineStringCoords})`;

    const payload = {
      routeId,
      routePath,
    };

    await dispatch(updateRoutePathDetailsAPI(payload)).unwrap();

    console.log('✅ Route Path Updated');
  };

  // ✅ FIXED handleStopItem: reads coords from ref synchronously before any state resets
  const handleStopItem = (id: string) => {
    const segmentCoordsSnapshot = [...livePolyCoordsRef.current];
    const finalDistance = Math.round(travelledDistanceRef.current);

    console.log(
      '🏁 Stopped. Distance:',
      finalDistance,
      'm | Coords:',
      segmentCoordsSnapshot.length,
    );

    stopTracking();

    // ✅ ONLY route path update here
    if (segmentCoordsSnapshot.length > 0) {
      callUpdateRoutePath(segmentCoordsSnapshot);
    }

    if (segmentCoordsSnapshot.length > 1) {
      setCompletedSegments(prev => [
        ...prev,
        {itemId: id, coords: segmentCoordsSnapshot},
      ]);

      const lastCoord = segmentCoordsSnapshot[segmentCoordsSnapshot.length - 1];
      lastSegmentEndCoordRef.current = lastCoord;
    }

    livePolyCoordsRef.current = [];
    setLivePolylineCoords([]);
    setPolylineCoords([]);
    travelledDistanceRef.current = 0;
    setTravelledDistance(0);
    lastPositionRef.current = null;
    currentTrackingItemIdRef.current = null;

    setAddedItems(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              status: 'idle',
              completed: true,
              distance: finalDistance,
            }
          : item,
      ),
    );
  };

  const handleAddMasterButtonClick = () => {
    setSelectedType(null);
    setMasterList([]);
    setAddMasterModalVisible(true);
  };

  const handleAddAndSelect = async () => {
    try {
      if (!selectedType) {
        Alert.alert('Error', 'Please select a master type');
        return;
      }
      if (!masterName.trim()) {
        Alert.alert('Error', 'Master Name is required');
        return;
      }
      if (!latLngText.trim()) {
        Alert.alert('Error', 'Lat/Lng is required');
        return;
      }
      if (!masterAddress.trim()) {
        Alert.alert('Error', 'Address is required');
        return;
      }
      if (!landmark.trim()) {
        Alert.alert('Error', 'Landmark is required');
        return;
      }
      setIsSubmitting(true);
      const payload: any = {
        Id: 0,
        Name: masterName.trim(),
        MasterType: selectedType.value,
        Address: masterAddress.trim(),
        SelectedAddress: selectedAddress.trim() || masterAddress.trim(),
        City: city.trim(),
        State: stateName.trim(),
        Country: country.trim(),
        Area: area.trim(),
        PinCode: pincode.trim(),
        Landmark: landmark.trim(),
        LatLng: latLngText.trim(),
      };
      if (extra1.trim()) payload.Extra1 = extra1.trim();
      if (extra2.trim()) payload.Extra2 = extra2.trim();
      if (image1) {
        payload.ImageFile1 = {
          uri: image1,
          type: 'image/jpeg',
          fileName: 'master_image_1.jpg',
        };
      }
      if (image2) {
        payload.ImageFile2 = {
          uri: image2,
          type: 'image/jpeg',
          fileName: 'master_image_2.jpg',
        };
      }
      await dispatch(UpdateMasterAPI(payload)).unwrap();
      Common.showToast('Master added!');
      // Reset form fields
      setMasterName('');
      setLatLngText('');
      setMasterAddress('');
      setSelectedAddress('');
      setLandmark('');
      setArea('');
      setCity('');
      setStateName('');
      setCountry('');
      setPincode('');
      setExtra1('');
      setExtra2('');
      setImage1('');
      setImage2('');
      setAddressSuggestions([]);

      // Close ONLY MasterFormModal
      setMastervisible(false);

      // Optional: refresh master list
      fetchMasterList(selectedType.value);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to add master');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen statusBgColor={COLORS.PRIMARY} statusBarStyle="light">
      <BackHeader title="Add Route" onBackPress={handleBackPress} showGps />
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          followsUserLocation={isTracking}
          showsCompass={true}
          showsScale={true}>
          {currentPosition && (
            <Marker coordinate={currentPosition} anchor={{x: 0.5, y: 0.5}}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(66, 133, 244, 0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: '#4285F4',
                    borderWidth: 3,
                    borderColor: '#FFFFFF',
                  }}
                />
              </View>
            </Marker>
          )}
          {addedItems.map(item => {
            if (item.latitude && item.longitude) {
              return (
                <Marker
                  key={item.id}
                  coordinate={{
                    latitude: item.latitude,
                    longitude: item.longitude,
                  }}
                  title={item.name}
                  description={`${item.label} - ${item.address}`}
                  anchor={{x: 0.5, y: 1}}>
                  <Image
                    source={item.icon}
                    style={{width: 35, height: 35}}
                    resizeMode="contain"
                  />
                </Marker>
              );
            }
            return null;
          })}
          {completedSegments.map((segment, index) => (
            <Polyline
              key={`completed-segment-${index}`}
              coordinates={segment.coords}
              strokeColor={COLORS.PRIMARY}
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
            />
          ))}
          {livePolylineCoords.length > 1 && (
            <Polyline
              coordinates={livePolylineCoords}
              strokeColor={COLORS.PRIMARY}
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>
      </View>
      <View style={styles.bodyBg}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.row, styles.rowFlexBox]}>
            <Image
              source={IMAGES.mapLocation}
              style={styles.icon}
              resizeMode="cover"
            />
            <Text style={[styles.f13MainRd, styles.mTypo]}>
              {address ? `${address}` : 'Fetching location...'}
            </Text>
            <View style={routeStyles.fixedMeter}>
              <Text style={routeStyles.fixedMeterText}>
                {Math.round(getTotalDistance() + travelledDistance)}m
              </Text>
            </View>
          </View>
          <View style={styles.contentWrapper}>
            <View style={styles.routeNameSection}>
              <View style={styles.routeNameRow}>
                <Text style={styles.routeLabel}>Route Name:</Text>
                <Text style={styles.routeValue}>
                  {isRouteAdded ? savedRouteName : routeName || 'XXXXXXXX'}
                </Text>
              </View>
              {!isRouteAdded && (
                <View style={styles.inputContainer}>
                  <TextInput
                    value={routeName}
                    onChangeText={setRouteName}
                    placeholder="Enter Route Name"
                    placeholderTextColor="#999"
                    style={styles.textInput}
                    returnKeyType="done"
                    returnKeyLabel="done"
                  />
                  <TouchableOpacity onPress={handleAddRoute}>
                    <LinearGradient
                      style={styles.addButton}
                      colors={[COLORS.colorMediumslateblue, '#6036c4']}>
                      <Text style={styles.addButtonText}>Add</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {addedItems.map((item, index) => {
              const isLastItem = index === addedItems.length - 1;
              const showAddMasterButton = item.completed && isLastItem;
              return (
                <View key={item.id}>
                  <View style={routeStyles.itemMainWrapper}>
                    <View style={routeStyles.leftSide}>
                      <Image
                        source={item.icon}
                        style={routeStyles.itemIconLeft}
                      />
                      <DashedLineVertical />
                      {!item.completed && <DashedLineHorizontal />}
                    </View>
                    <View style={routeStyles.rightSide}>
                      <View style={routeStyles.titleAndImageRow}>
                        <View style={{flex: 1}}>
                          <Text style={routeStyles.itemTitle}>
                            {item.label} • {item.name}
                          </Text>
                          <Text style={routeStyles.itemAddress}>
                            {trimToWords(item.address, 10)}
                          </Text>
                        </View>
                        {item.apiImage ? (
                          <TouchableOpacity
                            onPress={() => setPreviewImage(item.apiImage!)}>
                            <Image
                              source={{uri: item.apiImage}}
                              style={routeStyles.apiImageThumbnail}
                            />
                          </TouchableOpacity>
                        ) : item.images.length === 0 ? (
                          <TouchableOpacity
                            onPress={() => handleOpenCamera(item.id)}
                            style={routeStyles.addImageBtn}>
                            <Image
                              source={IMAGES.camera}
                              style={routeStyles.cameraIconSmall}
                              resizeMode="cover"
                            />
                            <Text style={routeStyles.addImageText}>
                              Add Image
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => setPreviewImage(item.images[0])}>
                            <Image
                              source={{uri: item.images[0]}}
                              style={routeStyles.apiImageThumbnail}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      {item.completed ? (
                        <Text style={routeStyles.completedDistance}>
                          {item.distance} m
                        </Text>
                      ) : (
                        <View style={routeStyles.actionButtonsBox}>
                          {item.status === 'started' && (
                            <View style={routeStyles.distancePill}>
                              <Image
                                source={IMAGES.walkingPerson}
                                style={routeStyles.buttonIcon2}
                              />
                              <Text style={routeStyles.distanceTextSmall}>
                                {Math.round(travelledDistance)} m
                              </Text>
                            </View>
                          )}
                          {item.status === 'idle' && (
                            <TouchableOpacity
                              onPress={() =>
                                updateItemStatus(item.id, 'started')
                              }
                              style={routeStyles.startButton}>
                              <Image
                                source={IMAGES.playIcon}
                                style={routeStyles.buttonIcon}
                              />
                              <Text style={routeStyles.startButtonText}>
                                Start
                              </Text>
                            </TouchableOpacity>
                          )}
                          {item.status === 'started' && (
                            <TouchableOpacity
                              onPress={() =>
                                updateItemStatus(item.id, 'paused')
                              }
                              style={routeStyles.pauseButton}>
                              <Image
                                source={IMAGES.pauseIcon}
                                style={routeStyles.buttonIcon}
                              />
                              <Text style={routeStyles.stopButtonText}>
                                Pause
                              </Text>
                            </TouchableOpacity>
                          )}
                          {item.status === 'paused' && (
                            <TouchableOpacity
                              onPress={() =>
                                updateItemStatus(item.id, 'started')
                              }
                              style={routeStyles.resumeButton}>
                              <Image
                                source={IMAGES.resumeIcon}
                                style={routeStyles.buttonIcon}
                              />
                              <Text style={routeStyles.resumeButtonText}>
                                Resume
                              </Text>
                            </TouchableOpacity>
                          )}
                          {(item.status === 'started' ||
                            item.status === 'paused') && (
                            <TouchableOpacity
                              onPress={() => handleStopItem(item.id)}
                              style={routeStyles.stopButton}>
                              <Image
                                source={IMAGES.stopIcon}
                                style={routeStyles.buttonIcon}
                              />
                              <Text style={routeStyles.stopButtonText}>
                                Stop
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                  {showAddMasterButton && (
                    <TouchableOpacity
                      onPress={handleAddMasterButtonClick}
                      style={routeStyles.addMasterButton}>
                      <Image
                        source={IMAGES.additionIcon}
                        style={routeStyles.addMasterIcon}
                      />
                      <Text style={routeStyles.addMasterText}>Add Master</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {isRouteAdded && addedItems.length === 0 && (
              <>
                <Text style={styles.routeLabel}>Route Start From</Text>
                <View style={styles.ul}>
                  {pickerData.map((item, index) => {
                    const isSelected = selectedType?.value === item.value;
                    const isLastItem = index === pickerData.length - 1;
                    return (
                      <TouchableOpacity
                        key={item.value}
                        style={[styles.li, !isLastItem && styles.liSpaceBlock]}
                        onPress={() => handleCheckboxSelect(item)}
                        activeOpacity={0.7}>
                        <View style={[styles.select, styles.labelFlexBox]}>
                          <View
                            style={[
                              styles.checkbox,
                              isSelected && styles.checkboxSelected,
                            ]}>
                            {isSelected && (
                              <Image
                                source={IMAGES.check}
                                style={styles.checkIconInner}
                                resizeMode="contain"
                              />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.routeStartFrom,
                              styles.routeTypo,
                              isSelected && styles.selectedText,
                            ]}>
                            {item.label}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {isLoadingMasters && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator
                      size="small"
                      color={COLORS.colorMediumslateblue}
                    />
                    <Text style={styles.loadingText}>Loading...</Text>
                  </View>
                )}
                {!isLoadingMasters && selectedType && masterList.length > 0 && (
                  <View style={styles.dataCountContainer}>
                    <Text style={styles.dataCountText}>
                      ✅ Found {masterList.length} {selectedType.label}(s)
                    </Text>
                  </View>
                )}
                {selectedType && !isLoadingMasters && (
                  <View style={styles.row4}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.gradientBtnTouchable}
                      onPress={handleOpenMasterModal}>
                      <LinearGradient
                        colors={[COLORS.colorMediumslateblue, '#6036c4']}
                        style={styles.gradientBg}
                        start={{x: 0.5, y: 0}}
                        end={{x: 0.5, y: 1}}
                      />
                      <Text style={styles.gradientBtnText}>Add New</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.gradientBtnTouchable}
                      onPress={handleExistingClick}>
                      <LinearGradient
                        colors={['#00c417', '#005e0b']}
                        style={styles.gradientBg}
                        start={{x: 0.5, y: 0}}
                        end={{x: 0.5, y: 1}}
                      />
                      <Text style={styles.gradientBtnText}>Existing</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
          {shouldShowEndRouteButton && (
            <TouchableOpacity
              onPress={handleSaveRoute}
              disabled={isSubmitting}
              style={routeStyles.view}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color={COLORS.WHITE} />
              ) : (
                <>
                  <Image
                    source={IMAGES.close}
                    style={routeStyles.vectorIcon2}
                    resizeMode="cover"
                  />
                  <Text style={routeStyles.endRoute}>End Route</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {/* Modals */}
          <Modal
            visible={addMasterModalVisible}
            transparent
            animationType="slide">
            <View style={modalStyles.overlay}>
              <View style={modalStyles.container}>
                <View style={modalStyles.header}>
                  <Text style={modalStyles.headerText}>Add Master</Text>
                  <TouchableOpacity
                    onPress={() => setAddMasterModalVisible(false)}
                    style={modalStyles.closeBtn}>
                    <Image
                      source={IMAGES.close}
                      style={modalStyles.closeIcon}
                    />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={modalStyles.scrollView}
                  showsVerticalScrollIndicator={false}>
                  <View style={modalStyles.checkboxContainer}>
                    {pickerData.map((item, index) => {
                      const isSelected = selectedType?.value === item.value;
                      return (
                        <TouchableOpacity
                          key={item.value}
                          style={[
                            modalStyles.checkboxItem,
                            index < pickerData.length - 1 &&
                              modalStyles.checkboxItemBorder,
                          ]}
                          onPress={() => handleCheckboxSelect(item)}
                          activeOpacity={0.7}>
                          <View
                            style={[
                              modalStyles.radioCircle,
                              isSelected && modalStyles.radioCircleSelected,
                            ]}>
                            {isSelected && (
                              <View style={modalStyles.radioInner} />
                            )}
                          </View>
                          <Text
                            style={[
                              modalStyles.checkboxLabel,
                              isSelected && modalStyles.checkboxLabelSelected,
                            ]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {isLoadingMasters && (
                    <View style={modalStyles.loadingContainer}>
                      <ActivityIndicator
                        size="small"
                        color={COLORS.colorMediumslateblue}
                      />
                      <Text style={modalStyles.loadingText}>Loading...</Text>
                    </View>
                  )}
                  {!isLoadingMasters &&
                    selectedType &&
                    masterList.length > 0 && (
                      <View style={modalStyles.dataCountContainer}>
                        <Text style={modalStyles.dataCountText}>
                          ✅ Found {masterList.length} {selectedType.label}(s)
                        </Text>
                      </View>
                    )}
                  {selectedType && !isLoadingMasters && (
                    <View style={modalStyles.actionButtons}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleOpenMasterModal}
                        style={modalStyles.actionButton}>
                        <LinearGradient
                          colors={[COLORS.colorMediumslateblue, '#6036c4']}
                          style={modalStyles.gradientButton}
                          start={{x: 0.5, y: 0}}
                          end={{x: 0.5, y: 1}}>
                          <Text style={modalStyles.buttonText}>Add New</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleExistingClick}
                        style={modalStyles.actionButton}>
                        <LinearGradient
                          colors={['#00c417', '#005e0b']}
                          style={modalStyles.gradientButton}
                          start={{x: 0.5, y: 0}}
                          end={{x: 0.5, y: 1}}>
                          <Text style={modalStyles.buttonText}>Existing</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
          <Modal visible={existingvisible} transparent animationType="slide">
            <View style={styles.alertmodal}>
              <View style={styles.view2}>
                <View style={styles.ulmasterModal}>
                  <View
                    style={[
                      styles.limasterModal,
                      styles.liFlexBox,
                      {marginBottom: SIZE.MS(10)},
                    ]}>
                    <Text style={[styles.action, styles.actionTypo]}>
                      Choose {selectedType?.label || 'Master'}
                    </Text>
                  </View>
                  <View style={[styles.modalBody, styles.liFlexBox]}>
                    {isLoadingMasters ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator
                          size="large"
                          color={COLORS.colorMediumslateblue}
                        />
                        <Text style={styles.loadingText}>Loading...</Text>
                      </View>
                    ) : masterList && masterList.length > 0 ? (
                      <ScrollView
                        style={{maxHeight: 400}}
                        showsVerticalScrollIndicator={false}>
                        {masterList.map((master, index) => {
                          const fullAddress = [
                            master.address,
                            master.area,
                            master.city,
                            master.state,
                            master.pincode,
                          ]
                            .filter(Boolean)
                            .join(', ');
                          return (
                            <TouchableOpacity
                              key={index}
                              activeOpacity={0.7}
                              onPress={() => handleMasterSelect(master)}
                              style={{
                                paddingVertical: 14,
                                paddingHorizontal: 12,
                                borderColor: COLORS.BACKGROUND_DEFAULT,
                                borderWidth: 1,
                              }}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'flex-start',
                                }}>
                                <View style={{flex: 1}}>
                                  <Text
                                    style={{
                                      fontSize: 14,
                                      fontWeight: '600',
                                      color: '#6C4DFF',
                                    }}>
                                    {master.name}{' '}
                                    {master.landmark
                                      ? `(${master.landmark})`
                                      : ''}
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      color: '#444',
                                      marginTop: 6,
                                    }}
                                    numberOfLines={3}>
                                    {fullAddress}
                                  </Text>
                                </View>
                                <View
                                  style={{
                                    backgroundColor: '#F1F1F1',
                                    borderRadius: 8,
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderWidth: 1,
                                    borderColor: '#DDD',
                                    marginLeft: 8,
                                  }}>
                                  <Text
                                    style={{fontSize: 13, color: '#6C4DFF'}}>
                                    {'20 m'}
                                  </Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                        <TouchableOpacity
                          onPress={() => setExistingvisible(false)}
                          style={{
                            marginTop: 15,
                            backgroundColor: '#E5E5E5',
                            paddingVertical: 10,
                            borderRadius: 20,
                            alignItems: 'center',
                          }}>
                          <Text style={{fontSize: 13, color: '#333'}}>
                            Close
                          </Text>
                        </TouchableOpacity>
                      </ScrollView>
                    ) : (
                      <View style={styles.noDataContainer}>
                        <Text style={styles.noDataText}>
                          No {selectedType?.label || 'data'} available
                        </Text>
                        <TouchableOpacity
                          onPress={() => setExistingvisible(false)}
                          style={[
                            styles.btn,
                            styles.btnFlexBox,
                            {
                              marginTop: 20,
                              backgroundColor: '#DBDBDB',
                              borderColor: '#DBDBDB',
                            },
                          ]}>
                          <Text style={[styles.selectMaster, styles.poleTypo]}>
                            Close
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </Modal>

          <MasterFormModal
            visible={mastervisible}
            selectedType={selectedType}
            masterName={masterName}
            latLngText={latLngText}
            selectedAddress={selectedAddress}
            masterAddress={masterAddress}
            landmark={landmark}
            onLandmarkChange={setLandmark}
            area={area}
            city={city}
            stateName={stateName}
            country={country}
            pincode={pincode}
            extra1={extra1}
            extra2={extra2}
            image1={image1}
            image2={image2}
            addressSuggestions={addressSuggestions}
            showAddressDropdown={showAddressDropdown}
            isFetchingLocation={isFetchingLocation}
            isSubmitting={isSubmitting}
            onClose={() => setMastervisible(false)}
            onMasterNameChange={setMasterName}
            onLatLngChange={setLatLngText}
            onSelectedAddressChange={setSelectedAddress}
            onMasterAddressChange={setMasterAddress}
            onAreaChange={setArea}
            onCityChange={setCity}
            onStateChange={setStateName}
            onCountryChange={setCountry}
            onPincodeChange={setPincode}
            onExtra1Change={setExtra1}
            onExtra2Change={setExtra2}
            onFetchLocation={handleFetchLocation}
            onAddressDropdownToggle={handleAddressDropdownToggle}
            onAddressSelect={handleAddressSelect}
            onOpenCamera={handleOpenCameraForModal}
            onImagePreview={setPreviewImage}
            onSubmit={handleAddAndSelect}
          />
        </ScrollView>
      </View>

      <Modal
        visible={!!previewImage}
        transparent
        onRequestClose={() => setPreviewImage(null)}>
        <TouchableOpacity
          style={routeStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPreviewImage(null)}>
          <View style={routeStyles.modalContent}>
            <Image
              source={{uri: previewImage!}}
              style={routeStyles.previewImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={routeStyles.closeButton}
              onPress={() => setPreviewImage(null)}>
              <Text style={routeStyles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
};

export default AddRouteScreen;

const routeStyles = StyleSheet.create({
  itemMainWrapper: {
    flexDirection: 'row',
    backgroundColor: COLORS.WHITE,
    position: 'relative',
    marginBottom: 16,
  },
  leftSide: {alignItems: 'center', width: 34},
  itemIconLeft: {width: 34, height: 34, resizeMode: 'contain'},
  dashedLineVerticalWrapper: {
    height: 55,
    width: 2,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  dashedSegment: {width: 2, height: 3, backgroundColor: '#CCCCCC'},
  dashedLineHorizontalWrapper: {
    width: 20,
    height: 2,
    alignSelf: 'flex-end',
    marginRight: -6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 1,
  },
  dashedSegmentHorizontal: {width: 3, height: 2, backgroundColor: '#CCCCCC'},
  addMasterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 10,
    marginHorizontal: 16,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: COLORS.colorMediumslateblue,
    borderStyle: 'dashed',
    backgroundColor: COLORS.WHITE,
  },
  addMasterIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.colorMediumslateblue,
    marginRight: 8,
  },
  addMasterText: {
    fontSize: 13,
    color: COLORS.colorMediumslateblue,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  rightSide: {flex: 1, gap: 10, marginLeft: 10, marginTop: 10},
  titleAndImageRow: {flexDirection: 'row', gap: 10, alignItems: 'flex-start'},
  itemTitle: {
    fontSize: 11,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  itemAddress: {
    fontSize: 10,
    color: '#666',
    fontFamily: FONTS.MEDIUM,
    lineHeight: 14,
    marginTop: 4,
  },
  apiImageThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#8858F9',
  },
  addImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C9B6FF',
    backgroundColor: COLORS.colorWhite,
  },
  cameraIconSmall: {
    width: 12,
    height: 12,
    tintColor: COLORS.colorMediumslateblue,
  },
  addImageText: {
    fontSize: 10,
    color: COLORS.colorMediumslateblue,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  actionButtonsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 5,
    backgroundColor: COLORS.colorWhite,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 50,
    padding: 4,
    alignSelf: 'flex-start',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 6,
    borderRadius: 50,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.ERROR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    marginLeft: 6,
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#B88D0D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    marginLeft: 6,
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.colorDarkgoldenrod,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    marginLeft: 6,
  },
  buttonIcon: {width: 9, height: 9, tintColor: COLORS.colorWhite},
  buttonIcon2: {width: 12, height: 12},
  startButtonText: {
    fontSize: 11,
    color: COLORS.colorWhite,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
    paddingLeft: 1,
  },
  stopButtonText: {
    fontSize: 11,
    color: COLORS.colorWhite,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  resumeButtonText: {
    fontSize: 11,
    color: COLORS.colorWhite,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  completedDistance: {
    marginTop: -20,
    fontSize: 12,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  distancePill: {
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 6,
    alignSelf: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    borderColor: '#C9B6FF',
  },
  distanceTextSmall: {
    fontSize: 11,
    color: COLORS.colorMediumslateblue,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  view: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 10,
    gap: 6,
    backgroundColor: COLORS.colorCrimson,
    borderRadius: 20,
    alignSelf: 'flex-end',
    marginRight: 10,
  },
  vectorIcon2: {height: 12, width: 12, tintColor: COLORS.WHITE},
  endRoute: {
    fontSize: 12,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
    color: COLORS.colorWhite,
    textAlign: 'left',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {width: '90%', height: '70%', position: 'relative'},
  previewImage: {width: '100%', height: '100%', borderRadius: 12},
  closeButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.WHITE,
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
  },
  fixedMeter: {
    width: 70,
    height: 28,
    borderRadius: 20,
    backgroundColor: COLORS.colorMediumslateblue,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  fixedMeterText: {
    fontSize: 12,
    color: COLORS.WHITE,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerText: {
    fontSize: 16,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
    color: COLORS.colorDarkslategray,
  },
  closeBtn: {padding: 4},
  closeIcon: {width: 14, height: 14, tintColor: '#666'},
  scrollView: {paddingHorizontal: 20},
  checkboxContainer: {paddingVertical: 16},
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  checkboxItemBorder: {borderBottomWidth: 1, borderBottomColor: '#F0F0F0'},
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CCC',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {borderColor: COLORS.colorMediumslateblue},
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.colorMediumslateblue,
  },
  checkboxLabel: {fontSize: 14, fontFamily: FONTS.MEDIUM, color: '#333'},
  checkboxLabelSelected: {
    color: COLORS.colorMediumslateblue,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
  },
  loadingContainer: {paddingVertical: 20, alignItems: 'center'},
  loadingText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontFamily: FONTS.MEDIUM,
  },
  dataCountContainer: {paddingVertical: 12},
  dataCountText: {fontSize: 12, color: '#4CAF50', fontFamily: FONTS.MEDIUM},
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  actionButton: {flex: 1},
  gradientButton: {paddingVertical: 12, borderRadius: 25, alignItems: 'center'},
  buttonText: {
    fontSize: 13,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
    color: COLORS.WHITE,
  },
});
