import {useNearestChambers} from '../../hooks/chambers';
import {useIssueCategories} from '../../hooks/issues';
import {useTicketDetails} from '../../hooks/tickets';
import {useAddFollowUp} from '../../hooks/tickets/useAddFollowUp';
import Geolocation from '@react-native-community/geolocation';
import {DataType} from '@types';
import {Header, OptionPickerSheet} from '@molecules';
import {COLORS, FONTS, SIZE, STYLES, IMAGES} from '@res';
import {checkCameraPermission} from '@slices/permission.slice';
import {Common, Preferences} from '../../utils';
import {RootState, StoreDispatch} from '@reducers';
import React, {useEffect, useState, useCallback, useRef} from 'react';
import {Screen} from '@organisms';
import {
  Padding,
  BoxShadow,
  Border,
  Gap,
  LetterSpacing,
  Height,
  Width,
  LineHeight,
  FontFamily,
  FontSize,
  Opacity,
} from '../../res/globalStyle';
import {BackHeader} from '@molecules';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  StatusBar,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Dimensions,
} from 'react-native';
import {Text} from 'react-native-animatable';
import {useDispatch, useSelector} from 'react-redux';
import {Chamber} from 'src/types/data-types';
import AddWatermark from '../../components/molecules/addWateramark';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

export const StartTicketScreen = ({
  navigation,
  route,
}: {
  navigation: any;
  route: any;
}) => {
  const {ticketId, ticketData} = route.params;
  const [selectedChamber, setSelectedChamber] = useState<Chamber | null>(null);
  const [optionpickerOpen, setOptionpickerOpen] = useState(false);
  const [isLoading, setisLoading] = useState<boolean>(false);
  const [issueFound, setIssueFound] = useState<boolean | null>(null);
  const [issueType, setIssueType] = useState<string | null>(null);
  const [issueCategoryId, setIssueCategoryId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<{
    label: string;
    value: number;
  } | null>(null);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [remarks, setRemarks] = useState<string>('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [currentPosition, setCurrentPosition] =
    useState<DataType.Coords | null>(null);
  const [errors, setErrors] = useState<any>({});
  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Image preview modal state
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string>('');
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);

  const watchIdRef = useRef<number | null>(null);
  const hasInitialPositionRef = useRef<boolean>(false);

  const dispatch = useDispatch<StoreDispatch>();
  const cameraPermission = useSelector(
    (state: RootState) => state.permission.camera,
  );
  const permissionLoading = useSelector(
    (state: RootState) => state.permission.loading === 'pending',
  );
  const {chambers, loading: chamberLoading} = useNearestChambers();
  const {ticketDetails, followUps, error, loading, refetch} =
    useTicketDetails(ticketId);
  const {
    addTwoPhaseFollowUp,
    loading: submitLoading,
    error: submitError,
  } = useAddFollowUp();
  const {
    categories,
    categoriesError,
    categoriesLoading,
    loadSpecificTypes,
    refreshCategories,
    selectedCategory,
    setSelectedCategory,
    specificTypes,
    typesError,
    typesLoading,
  } = useIssueCategories();

  useEffect(() => {
    dispatch(checkCameraPermission());
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
        enableHighAccuracy: true,
        timeout: 1000,
        maximumAge: 300000,
      },
    );
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
        timeout: 30000,
        maximumAge: 0,
      },
    );
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

  const onDone = (item: Chamber[]) => {
    setOptionpickerOpen(false);
    if (item && item.length > 0) {
      setSelectedChamber(item[0]);
      setErrors((prev: any) => ({
        ...prev,
        selectedChamber: undefined,
      }));
    }
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!selectedChamber) {
      newErrors.selectedChamber = 'Please select a chamber';
    }
    if (issueFound === null) {
      newErrors.issueFound = 'Please select if issue was found';
    }
    if (issueFound && issueType === null) {
      newErrors.issueType = 'Please select issue type';
    }
    if (issueFound && specificTypes.length > 0 && !selectedType) {
      newErrors.selectedType = 'Please select issue type';
    }
    if (selectedImages.length === 0) {
      newErrors.selectedImages = 'Please add at least one image';
    }
    if (!currentPosition) {
      newErrors.location = 'Location not available';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    if (!ticketDetails || !selectedChamber) {
      Alert.alert('Error', 'Ticket / Chamber missing');
      return;
    }
    console.log('📤 Submitting with:');
    console.log('  - issueCategoryId:', issueCategoryId);
    console.log('  - selectedType:', selectedType);
    const twoPhasePayload = {
      basic: {
        assignTaskId: ticketDetails.assignedTaskId.toString(),
        chamberId: selectedChamber.id.toString(),
        chamberName: selectedChamber.chamberName,
        remark: remarks,
        primaryImage: selectedImages[0],
        selectedChamber,
      },
      issue: issueFound
        ? {
            isIssueFound: true,
            issueCategory: issueCategoryId?.toString() || '',
            issueId: selectedType?.value.toString() || '',
            issueImages: selectedImages,
            issueRemarks: remarks,
          }
        : undefined,
      common: {
        ticketId: ticketId.toString(),
        transactionNumber: ticketDetails.transactionNumber,
        companyCode: 'GTPL',
        location: {
          lat: currentPosition?.latitude ?? 0,
          lng: currentPosition?.longitude ?? 0,
        },
      },
    };
    const res: any = await addTwoPhaseFollowUp(twoPhasePayload);
    if (res?.success) {
      Alert.alert('Success', res.message || 'Ticket started', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } else {
      Alert.alert('Error', res?.message || 'Failed');
    }
  };

  const handleImageCaptured = async (imageData: string) => {
    try {
      const permissionResult = await dispatch(checkCameraPermission()).unwrap();

      if (permissionResult === 'granted') {
        setSelectedImages(prev => [...prev, imageData]);
        setErrors((prev: any) => ({
          ...prev,
          selectedImages: undefined,
        }));
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

  const onTypeDone = (item: {label: string; value: number}[]) => {
    setTypePickerOpen(false);
    if (item && item.length > 0) {
      setSelectedType(item[0]);
      setErrors((prev: any) => ({
        ...prev,
        selectedType: undefined,
      }));
    }
  };

  console.log('🔍 Current state:');
  console.log('  - currentPosition:', currentPosition);

  return (
    <Screen
      statusBgColor={COLORS.PRIMARY}
      preset={'fixed'}
      loading={isLoading || loading}>
      <StatusBar backgroundColor={COLORS.PRIMARY} barStyle="light-content" />

      {/* Updated Header Section */}
      <View style={styles.headerWrapper}>
        <BackHeader headerTitle="Follow Ups" onBackPress={handleBackPress} />
        <View style={styles.floatingCard}>
          {/* Ticket Card */}
          <View style={styles.ticketCardContainer}>
            <View style={styles.ticketCard}>
              <Text style={styles.ticketText}>
                Ticket : {ticketData?.transactionNo}
              </Text>
            </View>
            {/* Circular Icon */}
            <View style={styles.iconCircle}>
              <Image
                source={IMAGES.Tickets}
                style={styles.ticketIcon}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollContainer}>
        <View style={styles.whiteBoxWrapper}>
          <View style={styles.container}>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>
                Chamber <Text style={styles.mandatory}>*</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  errors.selectedChamber && styles.inputError,
                ]}
                onPress={() => {
                  setOptionpickerOpen(true);
                  refetch();
                }}>
                <TextInput
                  style={styles.inputText}
                  placeholder="Select Chamber"
                  editable={false}
                  value={selectedChamber?.chamberName ?? ''}
                  placeholderTextColor={COLORS.TEXT_DARK}
                  pointerEvents="none"
                />
                <Image
                  source={IMAGES.down}
                  style={styles.dropdownIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              {errors.selectedChamber && (
                <Text style={styles.errorText}>{errors.selectedChamber}</Text>
              )}
            </View>

            {/* Issue Found - YES/NO */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>
                Issue Found <Text style={styles.mandatory}>*</Text>
              </Text>
              <View style={styles.radioContainer}>
                <TouchableOpacity
                  style={styles.radioButton}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIssueFound(true);
                    setErrors(prev => ({
                      ...prev,
                      issueFound: undefined,
                    }));
                  }}>
                  <View style={styles.radioOuter}>
                    {issueFound === true && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.radioText}>Yes</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioButton}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIssueFound(false);
                    setIssueType(null);
                    setIssueCategoryId(null);
                    setSelectedType(null);
                    setErrors(prev => ({
                      ...prev,
                      issueFound: undefined,
                    }));
                  }}>
                  <View style={styles.radioOuter}>
                    {issueFound === false && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.radioText}>No</Text>
                </TouchableOpacity>
              </View>
              {errors.issueFound && (
                <Text style={styles.errorText}>{errors.issueFound}</Text>
              )}
            </View>

            {/* Issue Category */}
            {issueFound === true &&
              Object.keys(categories || {}).length > 0 && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>
                    Issue Category <Text style={styles.mandatory}>*</Text>
                  </Text>
                  <View style={styles.radioContainer}>
                    {Object.keys(categories).map(label => {
                      const uniqueKey = `issue-${label}`;
                      const categoryId = categories[label];

                      return (
                        <TouchableOpacity
                          key={uniqueKey}
                          style={styles.radioButton}
                          activeOpacity={0.7}
                          onPress={() => {
                            setIssueType(label);
                            setIssueCategoryId(categoryId);
                            setSelectedCategory(categoryId);
                            setSelectedType(null);
                            loadSpecificTypes(categoryId);
                            setErrors(prev => ({
                              ...prev,
                              issueType: undefined,
                            }));
                          }}>
                          <View style={styles.radioOuter}>
                            {issueType === label && (
                              <View style={styles.radioInner} />
                            )}
                          </View>
                          <Text style={styles.radioText}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {errors.issueType && (
                    <Text style={styles.errorText}>{errors.issueType}</Text>
                  )}
                </View>
              )}

            {/* Issue Type Dropdown */}
            {issueFound === true && specificTypes.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>
                  Issue <Text style={styles.mandatory}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[
                    styles.input,
                    errors.selectedType && styles.inputError,
                  ]}
                  onPress={() => setTypePickerOpen(true)}>
                  <TextInput
                    style={styles.inputText}
                    placeholder="Select Type"
                    editable={false}
                    value={selectedType?.label ?? ''}
                    placeholderTextColor={COLORS.TEXT_DARK}
                    pointerEvents="none"
                  />
                  <Image
                    source={IMAGES.down}
                    style={styles.dropdownIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
                {errors.selectedType && (
                  <Text style={styles.errorText}>{errors.selectedType}</Text>
                )}
              </View>
            )}
            {/* Chamber Pictures */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>
                Chamber Pictures ({selectedImages.length}){' '}
                <Text style={styles.mandatory}>*</Text>
              </Text>
              <Text style={styles.takeClearPhotos}>
                Take clear photos showing both chambers.
              </Text>
              <AddWatermark
                currentPosition={currentPosition}
                onImageCaptured={handleImageCaptured}
                buttonText="+ Add Image"
                showPreview={false}
              />
              {errors.selectedImages && (
                <Text style={styles.errorText}>{errors.selectedImages}</Text>
              )}
              {selectedImages.length > 0 && (
                <View style={styles.imagesContainer}>
                  {selectedImages.map((image, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.imageItemGrid}
                      activeOpacity={0.7}
                      onPress={() => openImagePreview(image, index)}>
                      <Image
                        source={{uri: `data:image/png;base64,${image}`}}
                        style={styles.imageGridThumbnail}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={styles.removeButtonGrid}
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

            {/* Remarks */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Remarks</Text>
              <TextInput
                style={[styles.textarea, errors.remarks && styles.inputError]}
                placeholder="Enter remarks..."
                value={remarks}
                onChangeText={setRemarks}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor={COLORS.TEXT_DARK}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.submitButton,
                submitLoading && styles.submitButtonDisabled,
              ]}
              onPress={onSubmit}
              disabled={submitLoading}>
              <Text style={styles.submitText}>
                {submitLoading ? 'Submitting...' : 'Submit'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <OptionPickerSheet
        show={optionpickerOpen}
        title="Select Chamber"
        data={chambers}
        rowType="chamber"
        rowUniqueKey="uniqueKey"
        type="single"
        value={selectedChamber ? [selectedChamber] : []}
        onDone={onDone}
        onClose={() => setOptionpickerOpen(false)}
        loading={chamberLoading}
      />
      <OptionPickerSheet
        enableSearch={false}
        onClose={() => setTypePickerOpen(false)}
        onDone={onTypeDone}
        show={typePickerOpen}
        type="single"
        value={selectedType ? [selectedType] : []}
        rowType="labelValue"
        rowUniqueKey="value"
        title="Select Issue Type"
        data={specificTypes
          .filter(type => type && type.name && type.id)
          .map(type => ({
            label: type.name || 'Unknown',
            value: type.id || '',
          }))}
      />

      {/* Image Preview Modal */}
      <Modal
        visible={imagePreviewVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImagePreview}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeImagePreview}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>

            {/* Image Title */}
            <Text style={styles.previewTitle}>
              Image {previewImageIndex + 1} of {selectedImages.length}
            </Text>

            {/* Full Image Preview */}
            <ScrollView
              style={styles.previewImageContainer}
              contentContainerStyle={styles.previewImageContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}>
              <Image
                source={{uri: `data:image/png;base64,${previewImageUri}`}}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={removeImageFromPreview}>
                <Text style={styles.deleteButtonText}>Delete Image</Text>
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
    </Screen>
  );
};

export default StartTicketScreen;

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  ticketCardContainer: {
    marginTop: SIZE.MVS(20),
    position: 'relative',
    width: '100%', // 🔥 Fill floatingCard
    alignSelf: 'center',
    borderRadius: 10,
  },
  ticketCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(12),
    paddingVertical: SIZE.MVS(26),
    paddingHorizontal: SIZE.MS(16),
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  ticketText: {
    fontSize: SIZE.MS(15),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.TEXT_DARK || '#333',
    letterSpacing: 0.3,
  },
  whiteBoxWrapper: {
    backgroundColor: COLORS.WHITE,
    width: '94%', // 🔥 SAME AS FLOATING
    alignSelf: 'center', // 🔥 CENTER
    marginTop: SIZE.MVS(70),
    marginBottom: SIZE.MVS(20),
    borderRadius: SIZE.MS(12),
    padding: SIZE.MS(16),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  iconCircle: {
    position: 'absolute',
    top: -SIZE.MVS(25),
    left: '50%',
    marginLeft: -SIZE.MS(25),
    width: SIZE.MS(50),
    height: SIZE.MS(50),
    borderRadius: SIZE.MS(25),
    backgroundColor: '#FBEAA6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },

  ticketIcon: {
    width: SIZE.MS(24),
    height: SIZE.MS(24),
    tintColor: '#333333',
    resizeMode: 'contain',
  },
  container: {
    gap: SIZE.MS(15),
  },
  takeClearPhotos: {
    fontSize: 9,
    letterSpacing: 0.2,
    marginBottom: 12,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
  },
  fieldContainer: {
    width: '100%',
  },
  label: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.TEXT_DARK,
    marginBottom: SIZE.MS(8),
  },

  mandatory: {
    color: '#FF4444',
    fontSize: SIZE.MS(16),
  },

  input: {
    width: '100%',
    height: SIZE.MS(44),
    borderWidth: SIZE.MS(1),
    borderColor: COLORS.BORDER_DEFAULT || '#DDD',
    borderRadius: SIZE.MS(6),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZE.MS(12),
    backgroundColor: COLORS.WHITE,
  },

  inputText: {
    fontSize: SIZE.MS(16),
    color: COLORS.PRIMARY,
    flex: 1,
  },

  dropdownIcon: {
    width: SIZE.MS(20),
    height: SIZE.MS(20),
    tintColor: COLORS.TEXT_DARK,
    marginLeft: SIZE.MS(8),
  },

  inputError: {
    borderColor: '#FF4444',
  },

  errorText: {
    fontSize: SIZE.MS(12),
    color: '#FF4444',
    marginTop: SIZE.MS(4),
  },

  radioContainer: {
    flexDirection: 'row',
    gap: SIZE.MS(12),
    flexWrap: 'wrap',
  },

  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZE.MS(4),
    marginRight: SIZE.MS(8),
  },

  radioOuter: {
    height: SIZE.MS(24),
    width: SIZE.MS(24),
    borderRadius: SIZE.MS(12),
    borderWidth: SIZE.MS(2),
    borderColor: COLORS.PRIMARY || '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZE.MS(8),
  },

  radioInner: {
    height: SIZE.MS(12),
    width: SIZE.MS(12),
    borderRadius: SIZE.MS(6),
    backgroundColor: COLORS.PRIMARY || '#007AFF',
  },

  radioText: {
    fontSize: SIZE.MS(15),
    color: COLORS.TEXT_DARK,
  },

  textarea: {
    width: '100%',
    height: SIZE.MS(80),
    borderWidth: SIZE.MS(1),
    borderColor: COLORS.BORDER_DEFAULT || '#DDD',
    borderRadius: SIZE.MS(6),
    padding: SIZE.MS(12),
    fontSize: SIZE.MS(16),
    color: COLORS.TEXT_DARK,
    textAlignVertical: 'top',
    backgroundColor: COLORS.WHITE,
  },

  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: SIZE.MS(20),
    marginTop: SIZE.MS(10),
  },
  imageItemGrid: {
    width: (SCREEN_WIDTH - SIZE.MS(80)) / 2,
    height: SIZE.MS(120),
    position: 'relative',
    borderRadius: SIZE.MS(8),
    overflow: 'hidden',
    backgroundColor: COLORS.WHITE,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  imageGridThumbnail: {
    width: '100%',
    height: '100%',
    alignSelf: 'center',
  },

  removeButtonGrid: {
    position: 'absolute',
    top: SIZE.MS(8),
    right: SIZE.MS(8),
    width: SIZE.MS(28),
    height: SIZE.MS(28),
    borderRadius: SIZE.MS(14),
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },

  removeText: {
    color: 'white',
    fontSize: 18,
    lineHeight: 20,
  },

  submitButton: {
    width: '100%',
    height: SIZE.MS(50),
    backgroundColor: COLORS.PRIMARY || '#007AFF',
    borderRadius: SIZE.MS(8),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SIZE.MS(20),
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  submitText: {
    color: 'white',
    fontSize: SIZE.MS(16),
    fontFamily: FONTS.SEMI_BOLD,
  },

  // Modal Styles
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
    top: SIZE.MS(50),
    right: SIZE.MS(20),
    width: SIZE.MS(40),
    height: SIZE.MS(40),
    borderRadius: SIZE.MS(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  closeButtonText: {
    color: '#FFF',
    fontSize: 30,
  },

  previewTitle: {
    position: 'absolute',
    top: SIZE.MS(60),
    left: SIZE.MS(20),
    color: '#FFF',
    fontSize: 16,
    zIndex: 10,
  },

  previewImageContainer: {
    flex: 1,
    width: '100%',
    marginTop: SIZE.MS(100),
    marginBottom: SIZE.MS(100),
  },

  previewImageContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  previewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - SIZE.MS(200),
  },

  previewActions: {
    position: 'absolute',
    bottom: SIZE.MS(40),
    left: SIZE.MS(20),
    right: SIZE.MS(20),
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SIZE.MS(10),
  },

  deleteButton: {
    flex: 1,
    backgroundColor: '#FF4444',
    paddingVertical: SIZE.MS(15),
    borderRadius: SIZE.MS(8),
    alignItems: 'center',
  },

  deleteButtonText: {
    color: '#FFF',
    fontSize: 16,
  },
  floatingCard: {
    position: 'absolute',
    bottom: -SIZE.MVS(55),
    width: '94%', // 🔥 SAME WIDTH
    alignSelf: 'center', // 🔥 CENTER
    flexDirection: 'row',
    borderRadius: SIZE.MS(12),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  closeActionButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: SIZE.MS(15),
    borderRadius: SIZE.MS(8),
    alignItems: 'center',
  },
  headerWrapper: {
    backgroundColor: COLORS.PRIMARY,
    paddingBottom: SIZE.MVS(25),
    width: '100%',
  },
  closeActionButtonText: {
    color: '#FFF',
    fontSize: 16,
  },
});
