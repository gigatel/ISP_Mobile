import {Buttons} from '@atoms';
import {COLORS, IMAGES, SIZE, FONTS} from '@res';
import {DataType} from '@types';
import {Common, Preferences} from '@utils';
import React, {FC, memo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
} from 'react-native';
/*
 @ 𝔸𝕦𝕥𝕙𝕠𝕣: ℙ𝕒𝕟𝕜𝕒𝕛 𝕂𝕦𝕞𝕒𝕣 ℙ𝕣𝕒𝕛𝕒𝕡𝕒𝕥𝕚
 @ 𝔼𝕞𝕒𝕚𝕝: 𝕡𝕜𝕡𝕣𝕒𝕛𝕒𝕡𝕒𝕥𝕚𝟙𝟙𝟡𝟡𝟟@𝕘𝕞𝕒𝕚𝕝.𝕔𝕠𝕞
 */
interface Props {
  title: string;
  pic: DataType.ImagePickerResponse | null;
  setPic: (pic: DataType.ImagePickerResponse | null) => void;
  lat: number;
  long: number;
}

const CaptureChamberPicture: FC<Props> = ({title, pic, setPic, lat, long}) => {
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState<boolean>(false);
  const handleCapture = () => {
    setLoading(true);
    try {
      const geoAdd = Preferences.getData(
        'LAST_GEO_ADDRESS',
      ) as DataType.GeoAddress;
      Common.captureCameraImageWithWatermark(
        `Location: ${geoAdd?.address ?? 'N/A'}\nLatitude: ${lat?.toFixed(
          7,
        )} | Longitude : ${long?.toFixed(7)}\n${Common.getFormatedDate(
          'DD-MMM-YYYY hh:mm:ss A',
        )}`,
      ).then((data: any) => {
        setLoading(false);
        if (data) {
          setPic(data);
        } else {
          Common.showToast(
            'There is an issue in click picture and add watermark',
            'long',
          );
        }
      });
    } catch (error) {
      Common.error('ERROR IN CAPTURE IMAGE:', error);
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setPic(null);
  };

  return (
    <View style={styles.container}>
      {/* Camera Button */}
      <TouchableOpacity
        style={styles.cameraButton}
        onPress={handleCapture}
        disabled={loading}>
        <Image
          source={IMAGES.camera}
          style={styles.cameraIcon}
          resizeMode="contain"
        />
        <Text style={styles.buttonText}>{title}</Text>
      </TouchableOpacity>

      {/* Image Preview */}
      {pic?.path && (
        <View style={styles.imageContainer}>
          <Image
            source={{uri: pic.path}}
            style={styles.previewImage}
            resizeMode="cover"
          />
          {/* Remove Button */}
          <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
            <Image
              source={IMAGES.close}
              style={styles.closeIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      )}
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      )}
    </View>
  );
};

export default memo(CaptureChamberPicture);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  cameraButton: {
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: SIZE.MS(6),
    paddingVertical: SIZE.MS(6),
    paddingHorizontal: SIZE.MS(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZE.MS(6),
    backgroundColor: COLORS.WHITE,
    marginBottom: SIZE.MVS(6),
  },
  cameraIcon: {
    width: SIZE.MS(14),
    height: SIZE.MS(12),
    tintColor: COLORS.colorDarkslategray100,
  },
  buttonText: {
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray100,
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: SIZE.MS(90),
    borderRadius: SIZE.MS(6),
    backgroundColor: COLORS.BACKGROUND_LIGHT,
  },
  removeButton: {
    position: 'absolute',
    top: SIZE.MS(-6),
    right: SIZE.MS(-6),
    width: SIZE.MS(20),
    height: SIZE.MS(20),
    borderRadius: SIZE.MS(10),
    backgroundColor: COLORS.colorRed,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.BLACK,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  closeIcon: {
    width: SIZE.MS(8),
    height: SIZE.MS(8),
    tintColor: COLORS.WHITE,
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: SIZE.MS(6),
  },
});
