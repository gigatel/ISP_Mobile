import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Geolocation from '@react-native-community/geolocation';
import {PERMISSIONS, request, RESULTS} from 'react-native-permissions';
import {Screen} from '@organisms';
import {FONTS, IMAGES} from '@res';
import type {RootStackParamList} from '@navigation/navigator';
import type {SplitterCustomer} from './types';
import {
  invalidateCustomerConnections,
  customerCoreAssignment,
  getCustomerCoreReservations,
} from './customerPreview';
import {
  buildSplitterCustomerConnectivityPayload,
  saveSplitterCustomerConnectivity,
} from '../../services/splitterCustomerConnectivity';
import {getGigTubeCores} from '../../services/gigTubeCores';
import {getSplitterCustomers} from '../../services/lastMileSplitterCustomers';
import {isGigCoreUnavailable} from '../../services/nearbyGigRoutes';
import type {GigRoute} from '../../services/nearbyGigRoutes';
import SplitterIcon from './SplitterIcon';
import CallCustomerButton from './CallCustomerButton';
import CustomerConnectionSuccess from './CustomerConnectionSuccess';
import GigSelectionSheet from './GigSelectionSheet';
import {
  applyCustomerMasterDetails,
  lookupCustomerMaster,
  normalizeCustomerSearchInput,
} from '../../services/customerMasterLookup';
import {
  splitterRatio,
  splitterTitle,
} from '../../services/lastMileConnectivityService';
import {
  applyCustomerGpsAddress,
  getCustomerGpsAddress,
} from './customerGpsAddress';

const GRADIENT = ['#8858F9', '#6036C4'];
const ordinal = (leg: number) =>
  `${leg}${leg === 1 ? 'st' : leg === 2 ? 'nd' : leg === 3 ? 'rd' : 'th'}`;
const MAC_PATTERN = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;

export default function LastMileCustomerFormScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'LastMileCustomerForm'>) {
  const {splitter, leg, customer, connectionLeg} = route.params;
  const insets = useSafeAreaInsets();
  const screenFrame = useRef({width: 0, height: 0});
  const [footerOffset, setFooterOffset] = useState(0);
  const footerBottomPadding =
    Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 8;
  const footerHeight = 54 + footerBottomPadding;
  const formBottomMargin = footerOffset > 0 ? 0 : footerHeight;
  const scrollRef = useRef<ScrollView>(null);
  const bottomFieldFocused = useRef(false);
  const revealBottomFields = () => {
    if (bottomFieldFocused.current) {
      scrollRef.current?.scrollToEnd({animated: true});
    }
  };
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      if (bottomFieldFocused.current) {
        scrollRef.current?.scrollToEnd({animated: true});
      }
    });
    return () => subscription.remove();
  }, []);
  const [form, setForm] = useState<SplitterCustomer>(() =>
    customer
      ? {
          ...customer,
          connectivity: customer.connectivity.replace(/\s*\/\s*/g, ' '),
        }
      : {
          tube: '1',
          core: String(leg + 1),
          mobile: '',
          mac: '',
          name: '',
          address: '',
          latLng: '',
          online: true,
          connectivity: 'Virtual GIG',
          gig: '',
          landmark: '',
        },
  );
  const [query, setQuery] = useState(customer?.mobile ?? '');
  const queryError =
    /^\d+$/.test(query) && query.length !== 10
      ? `Enter a 10-digit mobile number (${query.length}/10).`
      : '';
  const [picker, setPicker] = useState<'connectivity' | 'gig' | null>(null);
  const [locating, setLocating] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savingRef = useRef(false);
  const lookupId = useRef(0);
  const deviceGps = useRef<string | null>(null);
  const [selectedGigRoute, setSelectedGigRoute] = useState<GigRoute | null>(
    null,
  );
  const isPhysicalGig = form.connectivity === 'Physical GIG';
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      lookupId.current += 1;
    };
  }, []);
  const update = (key: keyof SplitterCustomer, value: string) => {
    if (savingRef.current) {
      return;
    }
    if (key === 'latLng') {
      deviceGps.current = null;
    }
    setForm(previous => ({...previous, [key]: value}));
  };
  const changeQuery = (value: string) => {
    if (savingRef.current) {
      return;
    }
    lookupId.current += 1;
    setQuery(normalizeCustomerSearchInput(value));
    setFetching(false);
  };
  const fetchCustomer = async () => {
    if (savingRef.current) {
      return;
    }
    const search = query.trim();
    if (queryError) {
      Alert.alert('Customer details', queryError);
      return;
    }
    if (!search) {
      Alert.alert(
        'Customer details',
        'Enter a customer mobile number or MAC address.',
      );
      return;
    }
    const id = ++lookupId.current;
    setFetching(true);
    try {
      const found = await lookupCustomerMaster(search);
      if (!active.current || id !== lookupId.current) {
        return;
      }
      if (!found) {
        Alert.alert(
          'Customer not found',
          'No customer matches this mobile number or MAC address.',
        );
        return;
      }
      setForm(previous =>
        applyCustomerMasterDetails(previous, found, deviceGps.current),
      );
    } catch (failure: any) {
      if (active.current && id === lookupId.current) {
        Alert.alert(
          'Customer lookup',
          failure?.message || 'Could not fetch customer details. Please retry.',
        );
      }
    } finally {
      if (active.current && id === lookupId.current) {
        setFetching(false);
      }
    }
  };

  const getGps = async () => {
    if (savingRef.current) {
      return;
    }
    setLocating(true);
    try {
      const permission = await request(
        Platform.OS === 'ios'
          ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
          : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      );
      if (!active.current) {
        return;
      }
      if (permission !== RESULTS.GRANTED && permission !== RESULTS.LIMITED) {
        setLocating(false);
        Alert.alert(
          'Location permission',
          'Allow location access to fill your current coordinates, or enter them manually.',
        );
        return;
      }
      Geolocation.getCurrentPosition(
        async position => {
          if (!active.current) {
            return;
          }
          const {latitude, longitude} = position.coords;
          const gpsLatLng = `${latitude}, ${longitude}`;
          deviceGps.current = gpsLatLng;
          setForm(previous => ({
            ...previous,
            latLng: gpsLatLng,
            address: '',
            landmark: '',
          }));
          try {
            const locationText = await getCustomerGpsAddress(
              latitude,
              longitude,
            );
            if (!active.current) {
              return;
            }
            setForm(previous =>
              applyCustomerGpsAddress(previous, gpsLatLng, locationText),
            );
            if (!locationText.landmark) {
              Alert.alert(
                'Address found',
                'No nearby landmark was returned. You can enter the landmark manually.',
              );
            }
          } catch {
            if (active.current) {
              Alert.alert(
                'GPS location captured',
                'Address lookup is unavailable. Your device GPS coordinates are kept; enter the address and landmark manually.',
              );
            }
          } finally {
            if (active.current) {
              setLocating(false);
            }
          }
        },
        () => {
          if (!active.current) {
            return;
          }
          setLocating(false);
          Alert.alert(
            'Location unavailable',
            'Please try again or enter the customer coordinates manually.',
          );
        },
        {enableHighAccuracy: true, timeout: 15000, maximumAge: 0},
      );
    } catch {
      if (active.current) {
        setLocating(false);
        Alert.alert(
          'Location unavailable',
          'Please enter the coordinates manually.',
        );
      }
    }
  };

  const save = async () => {
    if (saved || fetching || locating || savingRef.current) {
      return;
    }
    const missingFields = [
      isPhysicalGig && !form.gig.trim() ? 'GIG, tube and core' : '',
      !form.mobile.trim() ? 'Customer mobile number' : '',
      !form.connectivity.trim() ? 'Connectivity' : '',
      !form.name.trim() ? 'Customer name' : '',
      !form.address.trim() ? 'Customer address' : '',
      !form.latLng.trim() ? 'Customer latitude and longitude' : '',
    ].filter(Boolean);
    if (missingFields.length) {
      Alert.alert(
        'Complete customer details',
        `Please fill: ${missingFields.join(', ')}.`,
      );
      return;
    }
    if (!/^\d{10}$/.test(form.mobile.trim())) {
      Alert.alert(
        'Invalid mobile number',
        'Enter a 10-digit customer mobile number.',
      );
      return;
    }
    if (form.mac.trim() && !MAC_PATTERN.test(form.mac.trim())) {
      Alert.alert('Invalid MAC address', 'Use the format A1:B2:C3:D4:E5:F6.');
      return;
    }
    const parts = form.latLng.split(',').map(value => value.trim());
    const [latitude, longitude] = parts.map(Number);
    if (
      parts.length !== 2 ||
      parts.some(value => !value) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      Alert.alert(
        'Invalid coordinates',
        'Enter a valid latitude and longitude separated by a comma.',
      );
      return;
    }
    if (
      isPhysicalGig &&
      selectedGigRoute &&
      isGigCoreUnavailable(
        selectedGigRoute,
        Number(form.tube),
        Number(form.core),
        getCustomerCoreReservations({splitterId: splitter.id, leg}),
        customerCoreAssignment(customer),
      )
    ) {
      Alert.alert(
        'Core already in use',
        'This core is connected to another customer. Select a different core.',
      );
      return;
    }
    try {
      savingRef.current = true;
      setSaving(true);
      Keyboard.dismiss();
      let existingCustomer = customer;
      if (customer && !customer.customerDetailId && !customer.id) {
        const refreshed = await getSplitterCustomers(splitter);
        if (!active.current) {
          return;
        }
        existingCustomer = refreshed[leg - 1] ?? undefined;
        if (!existingCustomer) {
          throw new Error(
            'This customer connection no longer exists. Reopen the splitter details.',
          );
        }
      }
      const payload = buildSplitterCustomerConnectivityPayload(
        splitter,
        leg,
        {
          ...form,
          id: existingCustomer?.id,
          customerDetailId: existingCustomer?.customerDetailId,
          latLng: `${latitude}, ${longitude}`,
        },
        connectionLeg,
        Boolean(customer),
      );
      const sameExistingCore =
        customer &&
        form.fiberMappingId === customer.fiberMappingId &&
        form.tube === customer.tube &&
        form.core === customer.core;
      if (isPhysicalGig && !sameExistingCore) {
        const options = await getGigTubeCores(
          payload.fiberMappingId,
          payload.tubeNo,
        );
        if (!active.current) {
          return;
        }
        const option = options.find(item => item.coreId === payload.coreNo);
        if (!option || option.isUsed) {
          throw new Error(
            'This core is already in use. Select a different core.',
          );
        }
      }
      await saveSplitterCustomerConnectivity(payload);
      invalidateCustomerConnections(splitter);
      if (active.current) {
        setSaved(true);
      }
    } catch (failure: any) {
      if (active.current) {
        Alert.alert(
          'Unable to connect customer',
          failure?.message || 'Could not save the connection. Please retry.',
        );
      }
    } finally {
      savingRef.current = false;
      if (active.current) {
        setSaving(false);
      }
    }
  };

  const renderField = (
    label: string,
    key: 'mobile' | 'mac' | 'name' | 'latLng' | 'address' | 'landmark',
    placeholder: string,
    muted = false,
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {['landmark', 'mac'].includes(key) ? (
          ' (optional)'
        ) : (
          <Text style={styles.required}> *</Text>
        )}{' '}
        :
      </Text>
      <View style={styles.fieldInputRow}>
        <TextInput
          accessibilityLabel={label}
          value={form[key]}
          editable={!saving && !['mobile', 'mac', 'name'].includes(key)}
          onChangeText={value => update(key, value)}
          onFocus={() => {
            bottomFieldFocused.current =
              key === 'address' || key === 'landmark';
            revealBottomFields();
          }}
          onBlur={() => {
            bottomFieldFocused.current = false;
          }}
          placeholder={placeholder}
          placeholderTextColor="#9699A2"
          style={[styles.input, styles.fieldInput, muted && styles.mutedInput]}
          keyboardType={key === 'mobile' ? 'phone-pad' : 'default'}
          maxLength={key === 'mobile' ? 10 : undefined}
          autoCapitalize={key === 'mac' ? 'characters' : 'sentences'}
        />
        {key === 'mobile' && (
          <CallCustomerButton mobile={form.mobile} disabled={saving} />
        )}
      </View>
    </View>
  );
  return (
    <Screen
      preset="fixed"
      isSafeArea={false}
      isNavSafeArea={false}
      keyboardAvoidingEnabled={false}
      statusBgColor="#8858F9"
      statusBarStyle="light">
      <View
        style={styles.screen}
        onLayout={event => {
          const {width, height} = event.nativeEvent.layout;
          // Android adjustResize shortens the root when the keyboard opens.
          // Compensate by keeping the footer at its original screen position.
          const previous = screenFrame.current;
          const fullHeight =
            width === previous.width
              ? Math.max(previous.height, height)
              : height;
          screenFrame.current = {width, height: fullHeight};
          setFooterOffset(Math.max(0, fullHeight - height));
        }}>
        <KeyboardAvoidingView
          style={[styles.formArea, {marginBottom: formBottomMargin}]}
          enabled={Platform.OS === 'ios'}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ImageBackground
            source={IMAGES.HeaderBkg}
            resizeMode="stretch"
            style={[styles.header, {paddingTop: insets.top + 8}]}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Go back"
              disabled={saving}
              onPress={() => navigation.goBack()}
              style={styles.backButton}>
              <Image source={IMAGES.back} style={styles.backIcon} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{splitterTitle(splitter)}</Text>
          </ImageBackground>
          <ScrollView
            ref={scrollRef}
            onLayout={revealBottomFields}
            keyboardDismissMode="on-drag"
            pointerEvents={saving ? 'none' : 'auto'}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.splitterRow}>
              <LinearGradient colors={GRADIENT} style={styles.splitterIcon}>
                <SplitterIcon size={17} />
              </LinearGradient>
              <Text style={styles.splitterName}>{splitterTitle(splitter)}</Text>
              <Text style={styles.splitterType}>
                Type: {splitterRatio(splitter)} | {ordinal(leg)} Leg
              </Text>
            </View>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>⊙</Text>
                <TextInput
                  accessibilityLabel="Customer mobile number or MAC search"
                  value={query}
                  onChangeText={changeQuery}
                  placeholder="Customer Mobile No. / MAC"
                  placeholderTextColor="#7F8491"
                  style={styles.searchInput}
                  autoCapitalize="none"
                  maxLength={17}
                  autoCorrect={false}
                  onSubmitEditing={fetchCustomer}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  onPress={() => changeQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear customer search"
                  style={styles.clearButton}>
                  <Text style={styles.clearText}>×</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fetch Customer"
                accessibilityState={{
                  disabled: fetching || Boolean(queryError),
                  busy: fetching,
                }}
                disabled={fetching || Boolean(queryError)}
                onPress={fetchCustomer}>
                <LinearGradient colors={GRADIENT} style={styles.fetchButton}>
                  {fetching ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Fetch Customer</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
            {queryError ? (
              <Text accessibilityRole="alert" style={styles.validationError}>
                {queryError}
              </Text>
            ) : null}
            <View style={styles.formCard}>
              <View style={styles.field}>
                <Text style={styles.label}>
                  Connectivity <Text style={styles.required}>*</Text> :
                </Text>
                <TouchableOpacity
                  style={styles.dropdown}
                  accessibilityRole="button"
                  accessibilityLabel={`Connectivity: ${form.connectivity}`}
                  onPress={() => setPicker('connectivity')}>
                  <Text style={styles.inputText}>{form.connectivity}</Text>
                  <Image source={IMAGES.down} style={styles.chevron} />
                </TouchableOpacity>
              </View>
              {isPhysicalGig && (
                <View style={styles.field}>
                  <Text style={styles.label}>
                    Select GIG <Text style={styles.required}>*</Text> :
                  </Text>
                  <TouchableOpacity
                    style={styles.dropdown}
                    accessibilityRole="button"
                    accessibilityLabel={`Select GIG: ${
                      form.gig || 'Not selected'
                    }`}
                    onPress={() => setPicker('gig')}>
                    <Text style={styles.inputText}>
                      {form.gig || 'Select GIG'}
                    </Text>
                    <Image source={IMAGES.down} style={styles.chevron} />
                  </TouchableOpacity>
                  {form.gig && form.tube && form.core ? (
                    <Text style={styles.selectedConnection}>
                      Tube {form.tube} • Core {form.core}
                    </Text>
                  ) : null}
                </View>
              )}
              {renderField(
                'Customer Mobile No.',
                'mobile',
                'Enter mobile number',
                true,
              )}
              {renderField(
                'Customer MAC Address',
                'mac',
                'Fetched customer MAC address',
                true,
              )}
              {renderField(
                'Customer Name',
                'name',
                'Enter customer name',
                true,
              )}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Customer Lat/Long <Text style={styles.required}>*</Text> :
                </Text>
                <View style={styles.gpsRow}>
                  <TextInput
                    accessibilityLabel="Customer latitude and longitude"
                    value={form.latLng}
                    onChangeText={value => update('latLng', value)}
                    placeholder="Latitude, Longitude"
                    placeholderTextColor="#9699A2"
                    style={[styles.input, styles.gpsInput]}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={locating}
                    onPress={getGps}
                    style={styles.gpsButton}>
                    <LinearGradient
                      pointerEvents="none"
                      colors={GRADIENT}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.buttonText}>
                      {locating ? 'Locating…' : 'Get Current GPS'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {renderField(
                'Customer Address',
                'address',
                'Enter customer address',
              )}
              {renderField('Landmark', 'landmark', 'Enter landmark')}
            </View>
          </ScrollView>
          <Modal
            visible={picker === 'connectivity'}
            transparent
            animationType="slide"
            onRequestClose={() => setPicker(null)}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setPicker(null)}
              accessibilityLabel="Close selection">
              <Pressable
                style={[
                  styles.pickerSheet,
                  {paddingBottom: Math.max(insets.bottom, 16)},
                ]}
                onPress={event => event.stopPropagation()}>
                <Text style={styles.pickerTitle}>Connectivity</Text>
                {['Virtual GIG', 'Physical GIG'].map(option => (
                  <TouchableOpacity
                    key={option}
                    accessibilityRole="button"
                    style={styles.pickerOption}
                    onPress={() => {
                      if (picker) {
                        update(picker, option);
                      }
                      setPicker(null);
                    }}>
                    <Text style={styles.inputText}>{option}</Text>
                    <Text style={styles.selectedMark}>
                      {picker && form[picker] === option ? '✓' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </Pressable>
            </Pressable>
          </Modal>
          {picker === 'gig' && (
            <GigSelectionSheet
              onClose={() => setPicker(null)}
              selectedFiberMappingId={form.fiberMappingId}
              selectedTube={form.tube}
              selectedCore={form.core}
              occupiedAssignments={getCustomerCoreReservations({
                splitterId: splitter.id,
                leg,
              })}
              editingAssignment={customerCoreAssignment(customer)}
              onSelect={(gigRoute, tube, core) => {
                setSelectedGigRoute(gigRoute);
                setForm(previous => ({
                  ...previous,
                  gig: gigRoute.fiberCode,
                  tube,
                  core,
                  fiberMappingId: gigRoute.id,
                  routeFiberMappingId: gigRoute.id,
                  routeId: gigRoute.routeId ?? undefined,
                  fiberMasterId: gigRoute.fiberMasterId ?? undefined,
                }));
                setPicker(null);
              }}
            />
          )}
        </KeyboardAvoidingView>
        <View
          style={[
            styles.footer,
            {paddingBottom: footerBottomPadding, bottom: -footerOffset},
          ]}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            disabled={saving}
            style={styles.cancelButton}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={save}
            accessibilityLabel="Save customer connection"
            disabled={fetching || locating || saving}
            accessibilityState={{
              disabled: fetching || locating || saving,
              busy: saving,
            }}
            style={styles.saveWrap}>
            <LinearGradient colors={GRADIENT} style={styles.saveButton}>
              {saving && <ActivityIndicator color="#FFFFFF" size="small" />}
              <Text style={styles.buttonText}>
                {saving
                  ? 'Connecting…'
                  : customer
                  ? 'Save Changes'
                  : `Save & Connect with ${ordinal(leg)} Leg`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {saved && (
          <CustomerConnectionSuccess
            customerName={form.name.trim()}
            splitterName={splitterTitle(splitter)}
            leg={leg}
            updated={Boolean(customer)}
            bottomInset={insets.bottom}
            onBackToList={() => navigation.popTo('LastMileConnectivity')}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F4F7FA'},
  formArea: {flex: 1},
  required: {color: '#D93343'},
  validationError: {
    fontFamily: FONTS.REGULAR,
    fontSize: 11,
    color: '#D93343',
    marginTop: -4,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 12,
    backgroundColor: '#7946E5',
  },
  backButton: {width: 28, minHeight: 40, justifyContent: 'center'},
  backIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  headerTitle: {
    flex: 1,
    fontFamily: FONTS.MEDIUM,
    fontSize: 15,
    color: '#FFFFFF',
  },
  scroll: {flex: 1, minHeight: 0},
  content: {padding: 14, paddingBottom: 18},
  splitterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 10,
  },
  splitterIcon: {
    width: 21,
    height: 21,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitterName: {
    flexGrow: 1,
    fontFamily: FONTS.BOLD,
    fontSize: 11,
    color: '#393D45',
  },
  splitterType: {fontFamily: FONTS.REGULAR, fontSize: 10, color: '#393D45'},
  searchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  searchBox: {
    flex: 1,
    minWidth: 190,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingHorizontal: 7,
  },
  searchIcon: {fontSize: 18, color: '#818794', marginRight: 4},
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.REGULAR,
    fontSize: 11,
    color: '#393D45',
    paddingVertical: 8,
  },
  clearButton: {
    width: 24,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F1F4',
    borderRadius: 4,
  },
  clearText: {fontSize: 20, color: '#626873'},
  fetchButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 1,
    elevation: 1,
    shadowColor: '#27314C',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  field: {marginBottom: 12},
  label: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 11,
    color: '#343943',
    marginBottom: 6,
  },
  selectedConnection: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 10,
    color: '#8050DF',
    marginTop: 5,
  },
  fieldInputRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  fieldInput: {flex: 1, minWidth: 0},
  input: {
    minHeight: 34,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E7E8EC',
    borderRadius: 6,
    fontFamily: FONTS.REGULAR,
    fontSize: 11,
    color: '#454B55',
  },
  mutedInput: {backgroundColor: '#E9E9E9', borderColor: '#E9E9E9'},
  dropdown: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: '#E7E8EC',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  inputText: {fontFamily: FONTS.REGULAR, fontSize: 11, color: '#454B55'},
  chevron: {width: 13, height: 13, resizeMode: 'contain', tintColor: '#5D6470'},
  gpsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 7},
  gpsInput: {flex: 1, minWidth: 150},
  gpsButton: {
    backgroundColor: '#8858F9',
    overflow: 'hidden',
    borderRadius: 6,
    minHeight: 34,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 11,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: '#F4F7FA',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5DFED',
  },
  cancelButton: {
    flex: 0.75,
    minHeight: 44,
    borderRadius: 7,
    backgroundColor: '#636667',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveWrap: {flex: 1},
  saveButton: {
    minHeight: 44,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(25,15,45,0.35)',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  pickerTitle: {
    fontFamily: FONTS.BOLD,
    color: '#343943',
    fontSize: 16,
    marginBottom: 10,
  },
  pickerOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEEAF5',
  },
  selectedMark: {color: '#7848DA', fontSize: 18},
});
