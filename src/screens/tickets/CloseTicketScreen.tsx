// screens/CloseTicketScreen.tsx
import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {useForm} from 'react-hook-form';
import {RootStackParamList} from '@navigation/navigator';
import {Common} from '@utils';
import {ticketService} from '../../services/ticketService';
import {COLORS, IMAGES, SIZE} from '@res';
import {OptionPickerSheet} from '@molecules';
import {CloseTicketFormData, RFOOption} from '../../schemas/closeTicket.schema';
import AddWatermark from '../../components/molecules/addWateramark';
import Geolocation from '@react-native-community/geolocation';
import {DataType} from '@types';
import {checkCameraPermission} from '@slices/permission.slice';
import {useDispatch, useSelector} from 'react-redux';
import {RootState, StoreDispatch} from '@reducers';
import {FONTS} from '@res';
import {
  FontSize,
  FontFamily,
  Border,
  Width,
  Gap,
  Height,
  BoxShadow,
  Padding,
  LineHeight,
} from '../../res/globalStyle';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

type CloseTicketRouteProp = RouteProp<RootStackParamList, 'CloseTicketScreen'>;
type CloseTicketNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CloseTicketScreen'
>;

const CloseTicketScreen: React.FC = () => {
  const route = useRoute<CloseTicketRouteProp>();
  const navigation = useNavigation<CloseTicketNavigationProp>();
  const dispatch = useDispatch<StoreDispatch>();

  const {ticketId, ticketData, comingFrom} = route.params as {
    ticketId: string;
    ticketData: any;
    comingFrom: 'COMPLAINTS' | 'TASKS';
  };

  // State Management
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rfoOptions, setRfoOptions] = useState<RFOOption[]>([]);
  const [rfoPickerOpen, setRfoPickerOpen] = useState(false);
  const isFromTasks = comingFrom === 'TASKS';

  // Image and Location States
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [currentPosition, setCurrentPosition] =
    useState<DataType.Coords | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const hasInitialPositionRef = useRef<boolean>(false);

  // Image Preview Modal States
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string>('');
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);

  // React Hook Form setup
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: {errors, isSubmitting},
  } = useForm<CloseTicketFormData>({
    defaultValues: {
      selectedRfoId: '',
      closureRemarks: '',
    },
  });

  // Watch form values
  const selectedRfoId = watch('selectedRfoId');
  const closureRemarks = watch('closureRemarks');

  // Initialize GPS and Camera Permission
  useEffect(() => {
    dispatch(checkCameraPermission());

    // Get cached position first (fast)
    Geolocation.getCurrentPosition(
      position => {
        console.log('📍 GPS LOADED (cached):', position.coords);
        setCurrentPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        hasInitialPositionRef.current = true;
      },
      error => {
        console.log('⚠️ No cached position, getting fresh...');
      },
      {
        enableHighAccuracy: false,
        timeout: 1000,
        maximumAge: 300000,
      },
    );

    // Get fresh position (accurate)
    Geolocation.getCurrentPosition(
      position => {
        console.log('📍 GPS LOADED (fresh):', position.coords);
        setCurrentPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        hasInitialPositionRef.current = true;
      },
      error => {
        console.log('❌ GPS ERROR:', error);
        if (!hasInitialPositionRef.current) {
          Alert.alert(
            'Location Error',
            'Unable to get your location. Please ensure GPS is enabled.',
            [{text: 'OK'}],
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );

    // Watch position continuously
    watchIdRef.current = Geolocation.watchPosition(
      position => {
        console.log('📍 GPS UPDATED:', position.coords);
        setCurrentPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        hasInitialPositionRef.current = true;
      },
      error => {
        console.log('❌ GPS WATCH ERROR:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5000,
        fastestInterval: 2000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        console.log('🛑 GPS Watch stopped');
      }
    };
  }, [dispatch]);

  useEffect(() => {
    if (!isFromTasks) {
      loadRFOOptions();
    } else {
      setLoading(false);
    }
  }, []);

  const loadRFOOptions = async () => {
    try {
      setLoading(true);
      Common.log('🔍 Loading RFO options...');
      const response = await ticketService.getRFOMasterDD();
      console.log('🔍 RFO options response:', response);
      if (response.success && response.data) {
        const mappedOptions: RFOOption[] = response.data.map((item: any) => ({
          id: item.id || item.rfoId || item.value,
          name: item.name || item.reason || item.description,
          description: item.description || '',
        }));
        setRfoOptions(mappedOptions);
        Common.log(`✅ ${mappedOptions.length} RFO options loaded`);
      } else {
        Common.showToast('No closure reasons found');
        setRfoOptions([]);
      }
    } catch (error) {
      Common.error('loadRFOOptions', error);
      Common.showToast('Failed to load closure reasons');
    } finally {
      setLoading(false);
    }
  };

  // Handle Image Captured
  const handleImageCaptured = async (imageData: string) => {
    try {
      const permissionResult = await dispatch(checkCameraPermission()).unwrap();

      if (permissionResult === 'granted') {
        setSelectedImages(prev => [...prev, imageData]);
      } else if (permissionResult === 'denied') {
        Alert.alert(
          'Camera Permission Required',
          'This app needs camera access to take photos for your ticket submissions.',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Try Again',
              onPress: () => dispatch(checkCameraPermission()),
            },
          ],
        );
      } else if (permissionResult === 'blocked') {
        Alert.alert(
          'Camera Permission Blocked',
          'Camera access has been blocked. Please enable camera permission in your device settings.',
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Open Settings', onPress: Common.openSettings},
          ],
        );
      }
    } catch (permissionError) {
      Alert.alert(
        'Error',
        'Failed to check camera permissions. Please try again.',
      );
    }
  };

  // Open image preview
  const openImagePreview = (imageUri: string, index: number) => {
    setPreviewImageUri(imageUri);
    setPreviewImageIndex(index);
    setImagePreviewVisible(true);
  };

  // Close image preview
  const closeImagePreview = () => {
    setImagePreviewVisible(false);
    setPreviewImageUri('');
  };

  // Remove image from preview modal
  const removeImageFromPreview = () => {
    Alert.alert(
      'Delete Image',
      `Are you sure you want to delete Image ${previewImageIndex + 1}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSelectedImages(
              selectedImages.filter((_, i) => i !== previewImageIndex),
            );
            closeImagePreview();
          },
        },
      ],
    );
  };

  // Remove Image
  const removeImage = (index: number) => {
    Alert.alert(
      'Delete Image',
      `Are you sure you want to delete Image ${index + 1}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSelectedImages(selectedImages.filter((_, i) => i !== index));
          },
        },
      ],
    );
  };

  // Submit Closure
  const onSubmit = async (data: CloseTicketFormData) => {
    Alert.alert(
      'Confirm Closure',
      'Are you sure you want to close this ticket? This action cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Close Ticket',
          style: 'destructive',
          onPress: () => submitClosure(data),
        },
      ],
    );
  };

  // Handle submit button press
  const handleSubmitClosure = () => {
    handleSubmit(onSubmit)();
  };

  const submitClosure = async (data: CloseTicketFormData) => {
    setSubmitting(true);
    try {
      const payload = {
        ticketId: ticketId,
        rfoId: isFromTasks ? 0 : data.selectedRfoId,
        closureRemarks: data.closureRemarks.trim(),
        status: 'Task Complete',
        closureImages: selectedImages.length > 0 ? selectedImages : undefined,
        primaryImage: selectedImages.length > 0 ? selectedImages[0] : undefined,
        location: currentPosition
          ? {
              lat: currentPosition.latitude,
              lng: currentPosition.longitude,
            }
          : undefined,
      };

      Common.log('🔒 Submitting ticket closure:', payload);
      const result = await ticketService.updateTaskRFO(payload);
      Common.log('🔒 Closure result:', result);

      Alert.alert(
        result.success ? 'Success' : 'Failed',
        result.message ||
          (result.success
            ? 'Ticket closed successfully'
            : 'Failed to close ticket'),
        [
          {
            text: 'OK',
            onPress: () => {
              if (result.success) {
                navigation.goBack();
              }
            },
          },
        ],
      );
    } catch (error) {
      Common.error('submitClosure', error);
      Alert.alert('Error', 'Failed to close ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // RFO Picker Handlers
  const openRFOPicker = () => {
    if (rfoOptions.length === 0) {
      Common.showToast('No closure reasons available');
      return;
    }
    setRfoPickerOpen(true);
  };

  const onRfoDone = (selectedItems: {label: string; value: string}[]) => {
    setRfoPickerOpen(false);
    if (selectedItems.length > 0) {
      const selectedRfo = selectedItems[0];
      setValue('selectedRfoId', selectedRfo.value);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
          <Text style={styles.loadingText}>Loading closure options...</Text>
        </View>
      </SafeAreaView>
    );
  }

  console.log('🔍 selectedRfoId:', selectedRfoId);
  console.log('📍 currentPosition:', currentPosition);
  console.log('📸 selectedImages:', selectedImages.length);

  return (
    <SafeAreaView style={styles.body}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonContainer}
          onPress={() => navigation.goBack()}>
          <Image
            source={IMAGES.back}
            style={styles.arrowBack24dp434343Fill0WIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View style={styles.lanheader}>
          <Text style={styles.closeTicket}>Close Ticket</Text>
        </View>
        <View style={styles.backButtonContainer} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.view}>
          <View style={styles.main}>
            {/* Header */}

            <View style={styles.bodyticket}>
              {/* Ticket Card */}
              <View style={styles.card}>
                {/* Left Decorative Tab */}
                <View style={styles.ticket}>
                  <View style={styles.ticketPattern}>
                    <Image source={IMAGES.bgIcon} style={styles.bgiconStyle} />
                  </View>
                </View>

                {/* Card Body */}
                <View style={styles.cardbody}>
                  <Image
                    source={IMAGES.TicketIcon}
                    style={styles.icon}
                    resizeMode="cover"
                  />
                  <View style={styles.text}>
                    <View style={styles.header2FlexBox}>
                      <Text style={styles.t06105}>
                        {ticketData?.transactionNo || 'T-06105'}
                      </Text>
                      <Text
                        style={[
                          styles.sifyTechnologiesPrivate,
                          styles.sifyTypo,
                        ]}>
                        {ticketData?.customerName ||
                          'SIFY Technologies Private Limited'}
                      </Text>
                    </View>
                    <View style={[styles.span, styles.btnFlexBox]}>
                      <Text style={[styles.sifyNoida, styles.sifyTypo]}>
                        {ticketData?.circuitFrom || 'SIFY Noida'}
                      </Text>
                      <Image
                        source={IMAGES.rightArrowNew}
                        style={styles.vectorIcon}
                        resizeMode="contain"
                      />
                      <Text style={[styles.sifyNoida, styles.sifyTypo]}>
                        {ticketData?.circuitTo || 'YOTTA DATA CENTER'}
                      </Text>
                    </View>
                    <View style={styles.span2}>
                      <View style={styles.label}>
                        <Text style={[styles.fault, styles.sifyTypo]}>
                          Fault:
                        </Text>
                      </View>
                      <Text style={[styles.loremIpsumIs, styles.sifyTypo]}>
                        {ticketData?.natureOfFault ||
                          'Lorem Ipsum is simply dummy text of the printing.'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* RFO Selection - Only for COMPLAINTS */}
              {!isFromTasks && (
                <View style={styles.formContainer}>
                  <View style={styles.control}>
                    <Text style={[styles.sectionTitle, styles.sifyTypo]}>
                      Closure Reason *
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.rfoSelector,
                        errors.selectedRfoId && styles.inputError,
                      ]}
                      onPress={openRFOPicker}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.rfoSelectorText,
                          !selectedRfoId && styles.rfoPlaceholder,
                        ]}>
                        {selectedRfoId
                          ? rfoOptions.find(opt => opt.id === selectedRfoId)
                              ?.name
                          : 'Select closure reason'}
                      </Text>
                      <Text style={styles.dropdownArrow}>▼</Text>
                    </TouchableOpacity>
                    {errors.selectedRfoId && (
                      <Text style={styles.errorText}>
                        {errors.selectedRfoId.message}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Final Remarks Section */}
              <View style={styles.formContainer}>
                <View style={styles.control}>
                  <Text style={[styles.sectionTitle, styles.sifyTypo]}>
                    Final Remarks
                  </Text>
                  <View style={styles.row}>
                    <View style={styles.col}>
                      <View style={styles.card2}>
                        <View style={styles.cardbody2}>
                          <TextInput
                            style={styles.textInput}
                            placeholder="Enter closure remarks (optional)"
                            placeholderTextColor="#2F455C99"
                            multiline
                            numberOfLines={4}
                            maxLength={500}
                            value={closureRemarks}
                            onChangeText={text =>
                              setValue('closureRemarks', text)
                            }
                            textAlignVertical="top"
                          />
                        </View>
                      </View>
                      <Text style={[styles.characters, styles.charactersTypo]}>
                        {closureRemarks.length}/500 characters
                      </Text>
                    </View>
                  </View>
                </View>
                {/* Closure Images Section */}
                <View style={styles.control}>
                  <Text style={[styles.sectionTitle, styles.sifyTypo]}>
                    Closure Images ({selectedImages.length})
                  </Text>
                  <View style={styles.row}>
                    <View style={styles.col2}>
                      <AddWatermark
                        currentPosition={currentPosition}
                        onImageCaptured={handleImageCaptured}
                        buttonText="+ Add Image"
                        showPreview={false}
                        customButton={
                          <TouchableOpacity style={styles.btn}>
                            <View style={styles.icon2}>
                              <View style={styles.plusIcon}>
                                <View style={styles.plusHorizontal} />
                                <View style={styles.plusVertical} />
                              </View>
                            </View>
                            <Text
                              style={[styles.addImage, styles.addImageTypo]}>
                              Add Image
                            </Text>
                          </TouchableOpacity>
                        }
                      />
                    </View>
                  </View>
                  {selectedImages.length > 0 && (
                    <View style={styles.imagesList}>
                      {selectedImages.map((imageUri, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.imageItem}
                          onPress={() => openImagePreview(imageUri, index)}>
                          <Image
                            source={{uri: `data:image/png;base64,${imageUri}`}}
                            style={styles.imageThumbnail}
                          />
                          <View style={styles.imageInfo}>
                            <Text style={styles.imageText}>
                              Image {index + 1}
                            </Text>
                            <Text style={styles.imageSubText}>Tap to view</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={e => {
                              e.stopPropagation();
                              removeImage(index);
                            }}>
                            <Text style={styles.removeText}>×</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                {/* Close Ticket Button */}
                <View style={[styles.control3, styles.header2FlexBox]}>
                  <TouchableOpacity
                    style={styles.closeTicketButton}
                    onPress={handleSubmitClosure}
                    disabled={submitting}>
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.closeTicket2, styles.addImageTypo]}>
                        CLOSE TICKET
                      </Text>
                    )}
                  </TouchableOpacity>
                  <View style={styles.span3}>
                    <Image
                      source={{
                        uri: 'https://cdn-icons-png.flaticon.com/512/564/564619.png',
                      }}
                      style={styles.circleExclamationSolidFullIcon}
                      resizeMode="contain"
                    />
                    <Text
                      style={[styles.onceClosedThis, styles.charactersTypo]}>
                      Once closed, this ticket cannot be reopened.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* RFO Option Picker Sheet */}
      {!isFromTasks && (
        <OptionPickerSheet
          enableSearch={false}
          onClose={() => setRfoPickerOpen(false)}
          onDone={onRfoDone}
          show={rfoPickerOpen}
          type="single"
          value={
            selectedRfoId
              ? rfoOptions
                  .filter(option => option.id === selectedRfoId)
                  .map(option => ({
                    label: option.name,
                    value: option.id,
                  }))
              : []
          }
          rowType="labelValue"
          rowUniqueKey="value"
          title="Select Closure Reason"
          data={rfoOptions.map(option => ({
            label: option.name,
            value: option.id,
          }))}
        />
      )}

      {/* Image Preview Modal */}
      <Modal
        visible={imagePreviewVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImagePreview}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeImagePreview}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
            <Text style={styles.previewTitle}>
              Image {previewImageIndex + 1} of {selectedImages.length}
            </Text>
            <ScrollView
              style={styles.previewImageContainer}
              contentContainerStyle={styles.previewImageContent}
              maximumZoomScale={3}
              minimumZoomScale={1}>
              <Image
                source={{uri: `data:image/png;base64,${previewImageUri}`}}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </ScrollView>
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={removeImageFromPreview}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeActionButton}
                onPress={closeImagePreview}>
                <Text style={styles.closeActionButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Styles
const styles = StyleSheet.create({
  body: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#2F455C',
    fontSize: 16,
    fontFamily: FONTS.MEDIUM,
  },
  view: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    width: '100%',
  },
  main: {
    gap: 20,
    alignSelf: 'stretch',
  },
  header: {
    gap: 12,
    alignItems: 'center',
    flexDirection: 'row',
    height: 48,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  backButtonContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lanheader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeTicket: {
    fontSize: 18,
    letterSpacing: -0.4,
    lineHeight: 23,
    textAlign: 'center',
    color: '#2F455C',
    fontFamily: FONTS.REGULAR,
    fontWeight: '500',
  },
  arrowBack24dp434343Fill0WIcon: {
    width: 24,
    height: 24,
  },
  bodyticket: {
    gap: 12,
    alignSelf: 'stretch',
  },
  card: {
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    maxWidth: 430,
    borderColor: '#E0E0E0',
    borderStyle: 'solid',
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  ticket: {
    width: 12,
    alignSelf: 'stretch',
    position: 'relative',
  },
  ticketPattern: {
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  bgiconStyle: {
    height: '100%',
    width: '100%',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  cardbody: {
    paddingHorizontal: SIZE.MS(12),
    paddingVertical: SIZE.MVS(12),
    justifyContent: 'center',
    gap: 12,
    flex: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  text: {
    gap: 8,
    alignSelf: 'stretch',
  },
  header2FlexBox: {
    gap: 4,
    alignSelf: 'stretch',
  },
  t06105: {
    fontSize: 20,
    textAlign: 'left',
    color: '#2F455C',
    fontFamily: FONTS.MEDIUM,
    fontWeight: '500',
    alignSelf: 'stretch',
  },
  sifyTypo: {
    fontSize: 13,
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  sifyTechnologiesPrivate: {
    color: '#2F455C',
    fontWeight: '500',
  },
  btnFlexBox: {
    gap: 7,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  span: {
    flexDirection: 'row',
  },
  sifyNoida: {
    color: '#2F455C',
  },
  vectorIcon: {
    height: 9,
    width: 13,
  },
  span2: {
    gap: 6,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  label: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fault: {
    color: '#DC143C',
    lineHeight: 20,
    fontWeight: '500',
    alignSelf: 'stretch',
  },
  loremIpsumIs: {
    lineHeight: 20,
    color: '#2F455C',
    flex: 1,
  },
  formContainer: {
    gap: 16,
  },
  control: {
    gap: 12,
    alignSelf: 'stretch',
  },
  sectionTitle: {
    color: '#2F455C',
    fontWeight: '500',
  },
  row: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  col: {
    gap: 6,
    flex: 1,
  },
  card2: {
    height: 103,
    borderRadius: 8,
    maxWidth: 430,
    borderColor: '#E0E0E0',
    borderStyle: 'solid',
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  cardbody2: {
    padding: 12,
    alignSelf: 'stretch',
    flex: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: '#2F455C',
    lineHeight: 20,
  },
  charactersTypo: {
    fontSize: 10,
    fontFamily: FONTS.SEMI_BOLD,
  },
  characters: {
    textAlign: 'right',
    opacity: 0.7,
    color: '#2F455C',
    fontWeight: '500',
    alignSelf: 'stretch',
  },
  col2: {
    flex: 1,
  },
  btn: {
    height: 38,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderColor: '#E0E0E0',
    paddingHorizontal: 17,
    paddingVertical: 8,
    gap: 7,
    alignItems: 'center',
    alignSelf: 'stretch',
    overflow: 'hidden',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
  },
  icon2: {
    height: 13,
    width: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    width: 13,
    height: 13,
    position: 'relative',
  },
  plusHorizontal: {
    position: 'absolute',
    width: 13,
    height: 2,
    backgroundColor: '#546E7A',
    borderRadius: 1,
    top: '50%',
    left: 0,
    marginTop: -1,
  },
  plusVertical: {
    position: 'absolute',
    width: 2,
    height: 13,
    backgroundColor: '#546E7A',
    borderRadius: 1,
    left: '50%',
    top: 0,
    marginLeft: -1,
  },
  addImageTypo: {
    fontSize: 14,
    textAlign: 'left',
    fontFamily: FONTS.SEMI_BOLD,
  },
  addImage: {
    color: '#546E7A',
    lineHeight: 20,
  },
  imagesList: {
    gap: 8,
    marginTop: 10,
  },
  imageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
  },
  imageThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  imageInfo: {
    flex: 1,
  },
  imageText: {
    fontSize: 14,
    color: '#2F455C',
    fontWeight: '600',
  },
  imageSubText: {
    fontSize: 12,
    color: '#2F455C',
    opacity: 0.6,
    marginTop: 2,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  control3: {
    paddingTop: 12,
  },
  closeTicketButton: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#DC143C',
    paddingHorizontal: 20,
    paddingVertical: 9,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  closeTicket2: {
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  span3: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 6,
    marginTop: 8,
  },
  circleExclamationSolidFullIcon: {
    height: 16,
    width: 16,
  },
  onceClosedThis: {
    color: '#FFA500',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: 'bold',
  },
  previewTitle: {
    position: 'absolute',
    top: 60,
    left: 20,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    zIndex: 10,
  },
  previewImageContainer: {
    flex: 1,
    width: '100%',
    marginTop: 100,
    marginBottom: 100,
  },
  previewImageContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 200,
  },
  previewActions: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FF4444',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeActionButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeActionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // RFO Selector Styles
  rfoSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
    elevation: 1,
  },
  rfoSelectorText: {
    flex: 1,
    fontSize: 14,
    color: '#2F455C',
  },
  rfoPlaceholder: {
    color: '#2F455C99',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#546E7A',
  },
  errorText: {
    color: '#DC143C',
    fontSize: 12,
    marginTop: 4,
  },
  inputError: {
    borderColor: '#DC143C',
  },
});

export default CloseTicketScreen;
