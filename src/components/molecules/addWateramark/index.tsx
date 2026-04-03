import {COLORS, FONTS, SIZE} from '@res';
import {DataType} from '@types';
import {Common, Preferences} from '@utils';
import React, {FC, memo, useState} from 'react';
import {FontFamily, FontSize} from '../../../res/globalStyle';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Alert,
} from 'react-native';
interface Props {
  currentPosition: DataType.Coords | null;
  onImageCaptured: (imageData: string) => void;
  buttonText?: string;
  showPreview?: boolean;
}
const AddWatermark: FC<Props> = ({
  currentPosition,
  onImageCaptured,
  buttonText = '+ Add Image',
  showPreview = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const handleCaptureImage = async () => {
    if (
      !currentPosition ||
      !currentPosition.latitude ||
      !currentPosition.longitude
    ) {
      Alert.alert(
        'Location Required',
        'Please wait for GPS location to load before capturing image.',
      );
      return;
    }
    setLoading(true);
    try {
      const geoAdd = Preferences.getData(
        'LAST_GEO_ADDRESS',
      ) as DataType.GeoAddress;
      const watermarkText = `Location: ${geoAdd?.address ?? 'N/A'}
    Latitude: ${currentPosition.latitude.toFixed(
      7,
    )} | Longitude : ${currentPosition.longitude.toFixed(7)}
     ${Common.getFormatedDate('DD-MMM-YYYY hh:mm:ss A')}`;
      console.log('🖋️ WATERMARK TEXT:', watermarkText);
      console.log('📍 Using Position:', currentPosition);
      const imageData: any = await Common.captureCameraImageWithWatermark(
        watermarkText,
      );
      if (imageData?.data) {
        showPreview && setPreviewImage(imageData.data);
        onImageCaptured(imageData.data);
      } else {
        Common.showToast(
          'There is an issue in click picture and add watermark',
          'long',
        );
      }
    } catch (error) {
      Common.error('ERROR IN CAPTURE IMAGE:', error);
      Alert.alert('Error', 'Camera failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {showPreview && previewImage && (
        <Image
          source={{uri: `data:image/png;base64,${previewImage}`}}
          style={styles.previewImage}
        />
      )}
      <TouchableOpacity
        style={styles.captureButton}
        onPress={handleCaptureImage}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color={COLORS.PRIMARY} />
        ) : (
          <Text style={styles.buttonText}>{buttonText}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default memo(AddWatermark);

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  previewImage: {
    width: '100%',
    height: SIZE.MS(200),
    marginBottom: SIZE.MS(10),
    borderRadius: SIZE.MS(8),
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: SIZE.MS(44),
    borderWidth: SIZE.MS(1),
    borderColor: COLORS.BORDER_DEFAULT,
    borderRadius: SIZE.MS(6),
    borderStyle: 'dashed',
    gap: SIZE.MS(8),
  },
  buttonText: {
    fontSize: FontSize.fs_16,
    color: COLORS.TEXT_DARK,
    fontWeight: '500',
    fontFamily: FONTS.SEMI_BOLD,
  },
});
