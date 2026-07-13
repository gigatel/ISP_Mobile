import React, {FC, useCallback, useState} from 'react';
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
} from 'react-native';
import {Screen} from '@organisms';
import {BackHeader} from '@molecules';
import {ScreenProps} from '@types';
import {COLORS, IMAGES, FONTS} from '@res';
import LinearGradient from 'react-native-linear-gradient';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import CustomPickerModule from './../../components/molecules/CustomPickerModule';
import {
  Padding,
  Border,
  Gap,
  FontFamily,
  FontSize,
  Height,
  LineHeight,
} from '../../res/globalStyle';
import {
  launchCamera,
  launchImageLibrary,
  ImageLibraryOptions,
  CameraOptions,
} from 'react-native-image-picker';
import {Common} from '@utils';
type RouteItem = {
  id: string;
  label: string;
  value: string;
  icon: any;
  status: 'idle' | 'started' | 'walking';
  completed: boolean;
  distance?: number;
  images: string[];
};
// ✅ Dashed Line Component for iOS compatibility
const DashedLineVertical = () => {
  return (
    <View style={styles.dashedLineVerticalWrapper}>
      {Array.from({length: 8}).map((_, i) => (
        <View key={i} style={styles.dashedSegment} />
      ))}
    </View>
  );
};
const DashedLineHorizontal = () => {
  return (
    <View style={styles.dashedLineHorizontalWrapper}>
      {Array.from({length: 5}).map((_, i) => (
        <View key={i} style={styles.dashedSegmentHorizontal} />
      ))}
    </View>
  );
};
const AddRouteScreen: FC<ScreenProps.AddRouteScreen> = ({navigation}) => {
  const [routeName, setRouteName] = useState('');
  const [savedRouteName, setSavedRouteName] = useState('');
  const [isRouteAdded, setIsRouteAdded] = useState(false);
  const [addedItems, setAddedItems] = useState<RouteItem[]>([]);
  const completedCount = addedItems.filter(item => item.completed).length;
  const [selectedType, setSelectedType] = useState<any>(null);
  const [isFirstItemStarted, setIsFirstItemStarted] = useState(false);
  const hasIncompleteItem = addedItems.some(item => !item.completed);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const addImagesToItem = (id: string, uris: string[]) => {
    setAddedItems(prev =>
      prev.map(item =>
        item.id === id ? {...item, images: [...item.images, ...uris]} : item,
      ),
    );
  };

  const handleOpenCamera = (id: string) => {
    const item = addedItems.find(i => i.id === id);

    if (item && item.images.length >= 1) {
      Alert.alert('Only one image allowed');
      return;
    }

    const options: CameraOptions = {
      mediaType: 'photo',
      cameraType: 'back',
      quality: 0.7,
      saveToPhotos: true,
    };

    launchCamera(options, response => {
      if (response.didCancel || !response.assets?.length) return;

      const uri = response.assets[0].uri;
      if (uri) {
        addImagesToItem(id, [uri]);
      }
    });
  };

  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const pickerData = [
    {
      label: 'Pole Master',
      value: 'pole',
      icon: IMAGES.PoleImage,
    },
    {
      label: 'Tree Master',
      value: 'tree',
      icon: IMAGES.treeIcon,
    },
    {label: 'Pop Master', value: 'pop', icon: IMAGES.TiffinIcon},
    {label: 'Enclosure', value: 'enclosure', icon: IMAGES.jointEnclosure},
    {label: 'Fiber Master', value: 'fiber', icon: IMAGES.TiffinIcon},
    {
      label: 'Third Party Module Provider',
      value: 'thirdParty',
      icon: IMAGES.TiffinIcon,
    },
    {
      label: 'Rack Master',
      value: 'rack',
      icon: IMAGES.TiffinIcon,
    },
    {
      label: 'FMS Master',
      value: 'fms',
      icon: IMAGES.TiffinIcon,
    },
    {
      label: 'LCO Master',
      value: 'lco',
      icon: IMAGES.TiffinIcon,
    },
    {
      label: 'Chamber Master',
      value: 'chamber',
      icon: IMAGES.TiffinIcon,
    },
  ];

  const handleAddRoute = () => {
    if (!routeName.trim()) return;
    setSavedRouteName(routeName.trim());
    setIsRouteAdded(true);
  };

  const handleAddItem = () => {
    if (!selectedType || hasIncompleteItem) return;

    setAddedItems(prev => [
      ...prev,
      {
        ...selectedType,
        id: Date.now().toString(),
        status: isFirstItemStarted ? 'idle' : 'started',
        completed: false,
        images: [],
      },
    ]);

    if (!isFirstItemStarted) {
      setIsFirstItemStarted(true);
    }

    setSelectedType(null);
  };

  const updateItemStatus = (id: string, status: RouteItem['status']) => {
    setAddedItems(prev =>
      prev.map(item => (item.id === id ? {...item, status} : item)),
    );
  };

  const handleStopItem = (id: string) => {
    setAddedItems(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              status: 'idle',
              completed: true,
              distance: 244,
            }
          : item,
      ),
    );
  };

  return (
    <Screen statusBgColor={COLORS.PRIMARY}>
      <BackHeader title="Add Route" onBackPress={handleBackPress} showGps />

      <View style={styles.container}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: 28.5355,
            longitude: 77.391,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}>
          <Marker coordinate={{latitude: 28.5355, longitude: 77.391}} />
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
              F-13 Main rd, Block F, Kalkaji, New Delhi, {'\n'}Delhi 110019,
              India
            </Text>
            <View style={[styles.meter, styles.addFlexBox]}>
              <Text style={[styles.m, styles.mClr]}>0m</Text>
            </View>
          </View>
          <View style={styles.contentWrapper}>
            {/* ROUTE NAME */}
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
                    style={styles.textInput}
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

            {/* ITEMS */}
            {addedItems.map(item => (
              <View key={item.id} style={styles.itemMainWrapper}>
                <View style={styles.leftSide}>
                  <Image source={item.icon} style={styles.itemIconLeft} />
                  <DashedLineVertical />
                  {!item.completed && <DashedLineHorizontal />}
                </View>
                <View style={styles.rightSide}>
                  <View style={{flexDirection: 'row'}}>
                    <Text style={styles.itemTitle}>
                      {item.label} • Lajpat Nagar Metro
                    </Text>

                    {item.images.length === 0 ? (
                      <TouchableOpacity
                        onPress={() => handleOpenCamera(item.id)}
                        style={[styles.btn, styles.btnFlexBox]}>
                        <Image
                          source={IMAGES.camera}
                          style={styles.vectorIcon}
                          resizeMode="cover"
                        />
                        <Text style={[styles.addImage, styles.m4Typo]}>
                          Add Image
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.imageThumbnailsContainer}>
                        <TouchableOpacity
                          onPress={() => setPreviewImage(item.images[0])}>
                          <Image
                            source={{uri: item.images[0]}}
                            style={styles.imageThumbnail}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleOpenCamera(item.id)}
                          style={styles.addMoreImageButton}>
                          <Image
                            source={IMAGES.camera}
                            style={styles.addMoreIcon}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {item.completed ? (
                    <Text style={styles.completedDistance}>
                      {item.distance} m
                    </Text>
                  ) : (
                    <View style={styles.actionButtonsBox}>
                      {item.status !== 'idle' && (
                        <View style={styles.distancePill}>
                          <Image
                            source={IMAGES.walkingPerson}
                            style={styles.buttonIcon2}
                          />
                          <Text style={styles.distanceTextSmall}>244 m</Text>
                        </View>
                      )}

                      <TouchableOpacity
                        onPress={() => updateItemStatus(item.id, 'started')}
                        disabled={item.status !== 'idle'}
                        style={[
                          styles.startButton,
                          item.status !== 'idle' && {opacity: 0.4},
                        ]}>
                        <Image
                          source={IMAGES.playIcon}
                          style={styles.buttonIcon}
                        />
                        <Text style={styles.startButtonText}>Start</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleStopItem(item.id)}
                        disabled={item.status === 'idle'}
                        style={[
                          styles.stopButton,
                          item.status === 'idle' && {opacity: 0.4},
                        ]}>
                        <Image
                          source={IMAGES.stopIcon}
                          style={styles.buttonIcon}
                        />
                        <Text style={styles.stopButtonText}>Stop</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => updateItemStatus(item.id, 'started')}
                        disabled={item.status === 'idle'}
                        style={[
                          styles.resumeButton,
                          item.status === 'idle' && {opacity: 0.4},
                        ]}>
                        <Image
                          source={IMAGES.resumeIcon}
                          style={styles.buttonIcon}
                        />
                        <Text style={styles.resumeButtonText}>Resume</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))}
            {isRouteAdded && (
              <CustomPickerModule
                data={pickerData}
                value={selectedType}
                placeholder="Select"
                onSelect={setSelectedType}
                onAddPress={handleAddItem}
                disabled={hasIncompleteItem}
                addButtonLabel={isFirstItemStarted ? 'Add' : 'Start From'}
              />
            )}
            {hasIncompleteItem && (
              <Text style={{fontSize: 11, color: COLORS.ERROR}}>
                Please complete current item before adding next
              </Text>
            )}
          </View>
          {completedCount >= 2 && (
            <TouchableOpacity
              onPress={() => Common.showToast('Route Added  Successfully')}
              style={styles.view}>
              <Image
                source={IMAGES.close}
                style={styles.vectorIcon2}
                resizeMode="cover"
              />
              <Text style={styles.endRoute}>End Route</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent
        onRequestClose={() => setPreviewImage(null)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPreviewImage(null)}>
          <View style={styles.modalContent}>
            <Image source={{uri: previewImage!}} style={styles.previewImage} />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setPreviewImage(null)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
};

export default AddRouteScreen;

const styles = StyleSheet.create({
  container: {
    flex: 0.8,
  },
  bodyBg: {
    backgroundColor: COLORS.colorWhite,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentWrapper: {
    padding: 16,
    gap: 12,
  },

  // Location Row
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
  },
  locationIcon: {
    height: 18,
    width: 15,
    resizeMode: 'contain',
    tintColor: '#8858F9',
    marginTop: 2,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
    lineHeight: 18,
  },
  distanceBadge: {
    backgroundColor: COLORS.colorGray200,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.colorGray100,
  },
  distanceText: {
    fontSize: 13,
    color: COLORS.colorMediumslateblue,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  meter: {
    paddingHorizontal: Padding.padding_6,
    paddingVertical: Padding.padding_2,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.colorGray100,
    borderStyle: 'solid',
    backgroundColor: COLORS.colorGray200,
    borderRadius: Border.br_6,
  },
  addImage: {
    color: COLORS.colorMediumslateblue100,
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  m: {
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
    fontSize: 13,
  },
  addFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  mClr: {
    color: COLORS.colorMediumslateblue100,
    fontWeight: '500',
  },

  // Route Name Section
  routeNameSection: {
    gap: 8,
  },
  routeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  m4Typo: {
    lineHeight: LineHeight.lh_22,
    fontSize: FontSize.fs_12,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
  },
  routeLabel: {
    fontSize: 13,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
  },
  routeValue: {
    fontSize: 13,
    color: '#8858F9',
    fontFamily: FONTS.MEDIUM,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.colorWhite,
    borderWidth: 1,
    borderColor: COLORS.colorGray100,
    borderRadius: 50,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
  },
  addButton: {
    height: 36,
    width: 60,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 13,
    color: COLORS.colorWhite,
    fontFamily: FONTS.MEDIUM,
  },
  btn: {
    paddingHorizontal: Padding.padding_10,
    paddingVertical: 0,
    gap: Gap.gap_4,
    borderRadius: Border.br_50,
    height: Height.height_30,
    alignItems: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.colorGray100,
    borderStyle: 'solid',
  },
  itemMainWrapper: {
    flexDirection: 'row',
    backgroundColor: COLORS.WHITE,
    position: 'relative',
  },
  leftSide: {
    alignItems: 'center',
    width: 34,
  },
  itemIconLeft: {
    width: 34,
    height: 34,
    resizeMode: 'contain',
  },

  // ✅ iOS-compatible Dashed Lines
  dashedLineVerticalWrapper: {
    height: 35,
    width: 2,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  dashedSegment: {
    width: 2,
    height: 3,
    backgroundColor: '#CCCCCC',
  },
  dashedLineHorizontalWrapper: {
    width: 20,
    height: 2,
    alignSelf: 'flex-end',
    marginRight: -6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 1,
  },
  dashedSegmentHorizontal: {
    width: 3,
    height: 2,
    backgroundColor: '#CCCCCC',
  },

  // Right Side - Content
  rightSide: {
    flex: 1,
    gap: 10,
    marginLeft: 10,
    marginTop: 10,
  },
  btnFlexBox: {
    gap: Gap.gap_4,
    justifyContent: 'center',
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    gap: 6,
    borderRadius: Border.br_38,
  },
  mTypo: {
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  icon: {
    height: 17,
    width: 18,
    tintColor: COLORS.colorMediumslateblue100,
  },
  f13MainRd: {
    color: COLORS.colorDarkslategray,
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
    flex: 1,
  },
  itemTitle: {
    fontSize: 11,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
    flex: 1,
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C9B6FF',
    backgroundColor: COLORS.colorWhite,
  },
  cameraIcon: {
    width: 14,
    height: 14,
    tintColor: '#8858F9',
  },
  addImageText: {
    fontSize: 11,
    color: '#8858F9',
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  // Image Thumbnails
  imageThumbnailsContainer: {
    marginTop: -30,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  imageThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#8858F9',
  },
  addMoreImageButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#C9B6FF',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F0FF',
  },
  addMoreIcon: {
    width: 24,
    height: 24,
    tintColor: '#8858F9',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '70%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    resizeMode: 'contain',
  },
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
  // Action Buttons Box
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
  buttonIcon: {
    width: 9,
    height: 9,
    tintColor: COLORS.colorWhite,
  },
  buttonIcon2: {
    width: 12,
    height: 12,
  },
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
  add: {
    flex: 1,
    backgroundColor: COLORS.colorCrimson,
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
  vectorIcon: {
    height: 12,
    width: 12,
    tintColor: COLORS.colorMediumslateblue200,
  },
  vectorIcon2: {
    height: 12,
    width: 12,
    tintColor: COLORS.WHITE,
  },
  endRoute: {
    fontSize: 12,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
    color: COLORS.colorWhite,
    textAlign: 'left',
  },
  rowFlexBox: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: 10,
    marginHorizontal: 10,
  },
});
