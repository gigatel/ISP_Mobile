// components/molecules/MasterFormModal.tsx
import React, {FC} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import {COLORS, FONTS, SIZE} from '@res';
import {
  Padding,
  Border,
  Gap,
  FontFamily,
  FontSize,
  Height,
  LetterSpacing,
} from '../../../res/globalStyle';
interface MasterFormModalProps {
  visible: boolean;
  selectedType: any;
  masterName: string;
  latLngText: string;
  selectedAddress: string;
  masterAddress: string;
  area: string;
  city: string;
  stateName: string;
  country: string;
  pincode: string;
  landmark: string;
  extra1: string;
  extra2: string;
  image1: string;
  image2: string;
  addressSuggestions: any[];
  showAddressDropdown: boolean;
  isFetchingLocation: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onMasterNameChange: (text: string) => void;
  onLatLngChange: (text: string) => void;
  onSelectedAddressChange: (text: string) => void;
  onMasterAddressChange: (text: string) => void;
  onAreaChange: (text: string) => void;
  onCityChange: (text: string) => void;
  onStateChange: (text: string) => void;
  onCountryChange: (text: string) => void;
  onPincodeChange: (text: string) => void;
  onLandmarkChange: (text: string) => void;
  onExtra1Change: (text: string) => void;
  onExtra2Change: (text: string) => void;
  onFetchLocation: () => void;
  onAddressDropdownToggle: () => void;
  onAddressSelect: (address: string) => void;
  onOpenCamera: (slot: 1 | 2) => void;
  onImagePreview: (uri: string) => void;
  onSubmit: () => void;
}
export const MasterFormModal: FC<MasterFormModalProps> = ({
  visible,
  selectedType,
  masterName,
  latLngText,
  selectedAddress,
  masterAddress,
  area,
  city,
  stateName,
  country,
  pincode,
  landmark,
  extra1,
  extra2,
  image1,
  image2,
  addressSuggestions,
  showAddressDropdown,
  isFetchingLocation,
  isSubmitting,
  onClose,
  onMasterNameChange,
  onLatLngChange,
  onSelectedAddressChange,
  onMasterAddressChange,
  onAreaChange,
  onCityChange,
  onStateChange,
  onCountryChange,
  onPincodeChange,
  onLandmarkChange,
  onExtra1Change,
  onExtra2Change,
  onFetchLocation,
  onAddressDropdownToggle,
  onAddressSelect,
  onOpenCamera,
  onImagePreview,
  onSubmit,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.masterModalOverlay}>
        <View style={styles.masterModalContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.ul3}>
              {/* Header */}
              <View style={styles.row5}>
                <View style={styles.col}>
                  <Text style={styles.addMasters}>Add Masters</Text>
                </View>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{paddingBottom: 20}}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                scrollEnabled={!showAddressDropdown}>
                <View style={styles.row6}>
                  {/* Master Type */}
                  <View style={styles.col}>
                    <View style={styles.formControl2}>
                      <Text style={styles.master}>
                        Master Type<Text style={styles.text3}>*</Text>
                      </Text>
                      <View style={styles.controller}>
                        <Text style={styles.pole2}>
                          {selectedType?.label || 'Select Master'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {/* Master Name */}
                  <View style={styles.col}>
                    <View style={styles.formControl2}>
                      <Text style={styles.latlng}>
                        Name<Text style={styles.text3}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.controller3}
                        placeholder="Enter  Name"
                        placeholderTextColor={COLORS.colorDarkslategray}
                        value={masterName}
                        onChangeText={onMasterNameChange}
                      />
                    </View>
                  </View>
                  {/* Lat/Lng with Fetch */}
                  <View style={styles.col}>
                    <View style={styles.formControl2}>
                      <Text style={styles.latlng}>
                        Lat/Lng<Text style={styles.text2}>*</Text>
                      </Text>
                      <View style={styles.latLngContainer}>
                        <TextInput
                          style={styles.latLngInput}
                          placeholder="Enter Lat, Lng"
                          placeholderTextColor={COLORS.colorDarkslategray}
                          value={latLngText}
                          onChangeText={onLatLngChange}
                          keyboardType="decimal-pad"
                        />
                        <TouchableOpacity
                          onPress={onFetchLocation}
                          disabled={isFetchingLocation}
                          style={[
                            styles.fetchBtn,
                            {
                              backgroundColor: isFetchingLocation
                                ? '#999'
                                : '#6036C4',
                            },
                          ]}>
                          {isFetchingLocation ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <Text style={styles.fetch}>Fetch</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  {/* Selected Address Dropdown */}
                  <View style={styles.col}>
                    <View style={styles.formControl2}>
                      <Text style={styles.latlng}>
                        Select Address<Text style={styles.text2}>*</Text>
                      </Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={onAddressDropdownToggle}>
                      <View pointerEvents="none">
                        <TextInput
                          style={styles.compactInput}
                          placeholder="Select Address"
                          placeholderTextColor={COLORS.colorDarkslategray}
                          value={selectedAddress}
                          editable={false}
                        />
                      </View>
                    </TouchableOpacity>

                    {showAddressDropdown && addressSuggestions?.length > 0 && (
                      <View style={styles.dropdownContainer}>
                        <ScrollView
                          nestedScrollEnabled
                          showsVerticalScrollIndicator
                          style={{maxHeight: 180}}>
                          {addressSuggestions.map((item, index) => (
                            <TouchableOpacity
                              key={index}
                              style={styles.dropdownItem}
                              onPress={() => {
                                console.log('📍 Selected:', item.value);
                                onAddressSelect(item.value); // ✅ ONLY THIS
                              }}>
                              <Text style={styles.dropdownText}>
                                {item.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                  {/* Landmark */}
                  <View style={styles.col}>
                    <View style={styles.formControl2}>
                      <Text style={styles.latlng}>
                        Landmark<Text style={styles.text2}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.compactInput}
                        placeholder="Enter Landmark"
                        placeholderTextColor={COLORS.colorDarkslategray}
                        value={landmark}
                        onChangeText={onLandmarkChange}
                        autoCorrect={false}
                        autoCapitalize="words"
                        returnKeyType="done"
                      />
                    </View>
                  </View>
                  {/* Address */}
                  <View style={styles.col}>
                    <View style={styles.formControl2}>
                      <Text style={styles.latlng}>
                        Address<Text style={styles.text2}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.compactInput}
                        placeholder="Enter Address"
                        placeholderTextColor={COLORS.colorDarkslategray}
                        value={masterAddress}
                        onChangeText={onMasterAddressChange}
                      />
                    </View>
                  </View>
                  {/* Area, City, State, Country, Pincode */}
                  {/* Area */}
                  {/* <View style={styles.col}>
                    <View style={styles.formControl2}>
                      <Text style={styles.master}>Area</Text>
                      <View style={styles.controller}>
                        <Text style={styles.pole2}>{area || '-'}</Text>
                      </View>
                    </View>
                  </View> */}
                  {/* City */}
                  {/* <View style={styles.col}>
                    <View style={styles.formControl2}>
                      <Text style={styles.master}>City</Text>
                      <View style={styles.controller}>
                        <Text style={styles.pole2}>{city || '-'}</Text>
                      </View>
                    </View>
                  </View> */}
                  {/* State */}
                  {/* <View style={styles.col}>
                    <View style={styles.formControl2}>
                      <Text style={styles.master}>State</Text>
                      <View style={styles.controller}>
                        <Text style={styles.pole2}>{stateName || '-'}</Text>
                      </View>
                    </View>
                  </View> */}
                  {/* Country */}
                  {/* <View style={styles.col}>
                    <View style={styles.formControl2}>
                      <Text style={styles.master}>Country</Text>
                      <View style={styles.controller}>
                        <Text style={styles.pole2}>{country || '-'}</Text>
                      </View>
                    </View>
                  </View> */}
                  {/* Pincode */}
                  {/* <View style={styles.col}>
                    <View style={styles.formControl2}>
                      <Text style={styles.master}>Pincode</Text>
                      <View style={styles.controller}>
                        <Text style={styles.pole2}>{pincode || '-'}</Text>
                      </View>
                    </View>
                  </View> */}
                  {/* Image 1 */}
                  <View style={styles.col}>
                    <View style={styles.formControl2}>
                      <Text style={styles.master}>Upload Image 1</Text>
                      <View style={styles.file}>
                        <TouchableOpacity
                          onPress={() => onOpenCamera(1)}
                          style={styles.controller6}>
                          <Text style={styles.ccdndKmpExpressway}>
                            Choose File
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.controller7}>
                          <Text style={styles.ccdndKmpExpressway}>
                            {image1 ? '1 Image Selected' : 'No file chosen'}
                          </Text>
                        </View>
                      </View>
                      {image1 && (
                        <View style={styles.imagePreviewContainer}>
                          <TouchableOpacity
                            onPress={() => onImagePreview(image1)}>
                            <Image
                              source={{uri: image1}}
                              style={styles.imageThumbnail}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                  {/* Image 2 */}
                  <View style={styles.col}>
                    <View style={styles.formControl2}>
                      <Text style={styles.master}>Upload Image 2</Text>
                      <View style={styles.file}>
                        <TouchableOpacity
                          onPress={() => onOpenCamera(2)}
                          style={styles.controller6}>
                          <Text style={styles.ccdndKmpExpressway}>
                            Choose File
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.controller7}>
                          <Text style={styles.ccdndKmpExpressway}>
                            {image2 ? '1 Image Selected' : 'No file chosen'}
                          </Text>
                        </View>
                      </View>
                      {image2 && (
                        <View style={styles.imagePreviewContainer}>
                          <TouchableOpacity
                            onPress={() => onImagePreview(image2)}>
                            <Image
                              source={{uri: image2}}
                              style={styles.imageThumbnail}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </ScrollView>
              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <View style={styles.row3FlexBox}>
                  <TouchableOpacity
                    onPress={onClose}
                    disabled={isSubmitting}
                    style={[
                      styles.btn,
                      styles.btnFlexBox,
                      {
                        backgroundColor: '#DBDBDB',
                        borderColor: '#DBDBDB',
                        opacity: isSubmitting ? 0.5 : 1,
                      },
                    ]}>
                    <Text style={styles.selectMaster}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onSubmit()}
                    disabled={isSubmitting}
                    style={[
                      styles.btn,
                      styles.btnFlexBox,
                      {
                        backgroundColor: '#8858F9',
                        borderColor: '#8858F9',
                        opacity: isSubmitting ? 0.5 : 1,
                        marginLeft: 10,
                      },
                    ]}>
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={[styles.selectMaster, {color: '#FFF'}]}>
                        Add
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  masterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  masterModalContainer: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: COLORS.colorWhite,
    borderRadius: 16,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  ul3: {
    borderRadius: 13,
    backgroundColor: COLORS.colorWhite,
    overflow: 'hidden',
  },
  row5: {
    paddingTop: Padding.padding_16,
    paddingBottom: Padding.padding_12,
    paddingHorizontal: Padding.padding_12,
  },
  col: {
    alignSelf: 'stretch',
  },
  addMasters: {
    fontSize: 15,
    letterSpacing: LetterSpacing.ls_0_1,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
    alignSelf: 'stretch',
  },
  row6: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingTop: Padding.padding_14,
    paddingBottom: Padding.padding_16,
    borderColor: COLORS.colorGray200,
    paddingHorizontal: Padding.padding_12,
    borderStyle: 'solid',
    gap: Gap.gap_8,
  },
  formControl2: {
    gap: Gap.gap_8,
    alignSelf: 'stretch',
  },
  master: {
    color: COLORS.colorDarkslategray100,
    fontSize: FontSize.fs_14,
    letterSpacing: LetterSpacing.ls_0_1,
    fontFamily: FontFamily.switzer,
    alignSelf: 'stretch',
  },
  controller: {
    backgroundColor: COLORS.colorGainsboro100,
    borderColor: COLORS.colorGainsboro200,
    borderWidth: 1,
    borderStyle: 'solid',
    height: Height.height_34,
    borderRadius: Border.br_50,
    alignSelf: 'stretch',
    overflow: 'hidden',
    paddingHorizontal: Padding.padding_12,
    justifyContent: 'center',
  },
  pole2: {
    color: COLORS.colorDarkslategray100,
    fontSize: FontSize.fs_14,
    letterSpacing: LetterSpacing.ls_0_1,
    fontFamily: FontFamily.switzer,
  },
  latlng: {
    fontSize: FontSize.fs_14,
    letterSpacing: LetterSpacing.ls_0_1,
    fontFamily: FontFamily.switzer,
    alignSelf: 'stretch',
  },
  text2: {
    color: COLORS.colorRed100,
  },
  text3: {
    color: COLORS.colorRed200,
  },
  controller3: {
    borderColor: COLORS.colorGainsboro200,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: Border.br_50,
    backgroundColor: COLORS.colorWhite,
    paddingVertical: Padding.padding_9,
    paddingHorizontal: Padding.padding_12,
    alignSelf: 'stretch',
  },
  controller4: {
    borderColor: COLORS.colorGainsboro200,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: Border.br_50,
    backgroundColor: COLORS.colorWhite,
    paddingVertical: Padding.padding_9,
    paddingHorizontal: Padding.padding_12,
    alignSelf: 'stretch',
  },
  latLngContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  latLngInput: {
    flex: 1,
    borderColor: COLORS.colorGainsboro200,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: Border.br_50,
    backgroundColor: COLORS.colorWhite,
    paddingVertical: Padding.padding_9,
    paddingHorizontal: Padding.padding_12,
  },
  fetchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Border.br_50,
    minWidth: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fetch: {
    textAlign: 'center',
    color: COLORS.colorWhite,
    fontWeight: '500',
    fontFamily: FONTS.MEDIUM,
  },
  compactInput: {
    borderColor: COLORS.colorGainsboro200,
    borderWidth: 1,
    borderRadius: Border.br_50,
    backgroundColor: COLORS.colorWhite,
    paddingHorizontal: Padding.padding_12,
    height: 40,
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    zIndex: 9999,
    elevation: 10,
    maxHeight: 180,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  dropdownText: {
    fontSize: 13,
    color: '#444',
  },
  file: {
    borderRadius: Border.br_50,
    backgroundColor: COLORS.colorWhite,
    flexDirection: 'row',
    alignSelf: 'stretch',
    borderColor: COLORS.colorGainsboro200,
    borderWidth: 1,
    borderStyle: 'solid',
  },
  controller6: {
    borderTopLeftRadius: Border.br_50,
    borderBottomLeftRadius: Border.br_50,
    backgroundColor: COLORS.colorWhitesmoke,
    borderColor: COLORS.colorGainsboro200,
    borderWidth: 1,
    borderStyle: 'solid',
    overflow: 'hidden',
    paddingVertical: Padding.padding_9,
    paddingHorizontal: Padding.padding_12,
    alignItems: 'center',
  },
  controller7: {
    borderRadius: Border.br_8,
    overflow: 'hidden',
    flex: 1,
    paddingVertical: Padding.padding_9,
    paddingHorizontal: Padding.padding_12,
  },
  ccdndKmpExpressway: {
    color: COLORS.colorDarkslategray100,
    fontSize: FontSize.fs_14,
    letterSpacing: LetterSpacing.ls_0_1,
    fontFamily: FontFamily.switzer,
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  imageThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  buttonContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: COLORS.colorGray200,
  },
  row3FlexBox: {
    justifyContent: 'flex-end',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  btn: {
    paddingHorizontal: Padding.padding_10,
    paddingVertical: Padding.padding_8,
    borderRadius: Border.br_50,
  },
  btnFlexBox: {
    gap: Gap.gap_4,
    justifyContent: 'center',
    width: '40%',
    borderWidth: 0.5,
    alignItems: 'center',
  },
  selectMaster: {
    fontSize: FontSize.fs_12,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
    color: COLORS.colorDarkslategray,
    fontWeight: '500',
  },
});
