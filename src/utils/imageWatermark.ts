import {OLA_MAP_API} from '@env';
import {COLORS, FONTS} from '@res';
import moment from 'moment';
import ImageMarker, {
  ImageFormat,
  Position,
  TextBackgroundType,
  type WatermarkLayer,
} from 'react-native-image-marker';
import {getGeoLocation, getAddressWithLatLong} from './location';
import {getData} from './preferences';

type WatermarkLocation = {
  latitude?: number;
  longitude?: number;
  address?: string;
};

type WatermarkImageSize = {
  width?: number;
  height?: number;
};

const validCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const withFileScheme = (path: string) =>
  /^(file|content):\/\//i.test(path) ? path : `file://${path}`;

const WATERMARK_FILE_PREFIX = 'GTPL_';
const MAX_WATERMARK_IMAGE_DIMENSION = 1280;

export const isLocationWatermarked = (imageUri: string) => {
  const cleanUri = decodeURIComponent(imageUri || '').split(/[?#]/)[0];
  const fileName = cleanUri.substring(cleanUri.lastIndexOf('/') + 1);
  return fileName.toUpperCase().startsWith(WATERMARK_FILE_PREFIX);
};

const MAP_ZOOM = 15;
const MAP_SCALE = 0.44;
const MAP_SIZE = 256 * MAP_SCALE;
const CARD_INSET = 6;

const getMapTile = async (latitude: number, longitude: number) => {
  if (!OLA_MAP_API) {
    return null;
  }

  const RNFS = require('react-native-fs');
  const coordinateKey = `${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
  const localPath = `${RNFS.CachesDirectoryPath}/gtpl_watermark_static_${MAP_ZOOM}_${coordinateKey}.png`;
  const downloadPath = `${localPath}.download`;

  try {
    if (!(await RNFS.exists(localPath))) {
      const center = `${longitude},${latitude},${MAP_ZOOM}`;
      const marker = encodeURIComponent(
        `${longitude},${latitude}|red|scale:0.9`,
      );
      const url =
        'https://api.olamaps.io/tiles/v1/styles/default-light-standard/static/' +
        `${center}/256x256.png?marker=${marker}` +
        `&api_key=${encodeURIComponent(OLA_MAP_API)}`;
      const result = await RNFS.downloadFile({
        fromUrl: url,
        toFile: downloadPath,
        connectionTimeout: 5000,
        readTimeout: 5000,
      }).promise;

      if (result.statusCode < 200 || result.statusCode >= 300) {
        if (await RNFS.exists(downloadPath)) {
          await RNFS.unlink(downloadPath);
        }
        return null;
      }
      await RNFS.moveFile(downloadPath, localPath);
    }

    const fileInfo = await RNFS.stat(localPath);
    if (!fileInfo.size || Number(fileInfo.size) < 1000) {
      await RNFS.unlink(localPath);
      return null;
    }

    return withFileScheme(localPath);
  } catch {
    try {
      if (await RNFS.exists(downloadPath)) {
        await RNFS.unlink(downloadPath);
      }
    } catch {}
    return null;
  }
};

const wrapText = (value: string, maxLength = 52) => {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxLength || !currentLine) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 2).join('\n');
};

const getWatermarkLocation = async (
  supplied?: WatermarkLocation,
): Promise<Required<WatermarkLocation>> => {
  const saved = (getData('LAST_GEO_ADDRESS') ?? {}) as {
    lat?: number;
    long?: number;
    address?: string;
    addres?: string;
  };

  let latitude = supplied?.latitude;
  let longitude = supplied?.longitude;

  if (!validCoordinate(latitude) || !validCoordinate(longitude)) {
    try {
      const position = await getGeoLocation();
      latitude = position?.coords?.latitude;
      longitude = position?.coords?.longitude;
    } catch (locationError: any) {
      latitude = locationError?.coords?.latitude ?? saved.lat;
      longitude = locationError?.coords?.longitude ?? saved.long;
    }
  }

  latitude = validCoordinate(latitude) ? latitude : saved.lat;
  longitude = validCoordinate(longitude) ? longitude : saved.long;

  if (!validCoordinate(latitude) || !validCoordinate(longitude)) {
    throw new Error(
      'Current GPS coordinates are unavailable. Enable location and try again.',
    );
  }

  const savedAddress = saved.address?.trim() || saved.addres?.trim() || '';
  const savedAddressIsNearby =
    validCoordinate(saved.lat) &&
    validCoordinate(saved.long) &&
    Math.abs(latitude - saved.lat) < 0.001 &&
    Math.abs(longitude - saved.long) < 0.001;
  let address =
    supplied?.address?.trim() ||
    (savedAddressIsNearby ? savedAddress : '');

  if (!address) {
    const resolvedAddress = await getAddressWithLatLong(latitude, longitude);
    address = resolvedAddress?.address?.trim() || '';
  }

  return {
    latitude,
    longitude,
    address: address || 'Address not available',
  };
};

export const buildLocationWatermarkText = async (
  location?: WatermarkLocation,
  capturedAt = new Date(),
) => {
  const resolved = await getWatermarkLocation(location);

  return [
    `Location: ${wrapText(resolved.address)}`,
    `Lat: ${resolved.latitude.toFixed(7)} | Lng: ${resolved.longitude.toFixed(
      7,
    )}`,
    `Date: ${moment(capturedAt).format(
      'DD-MMM-YYYY',
    )} | Time: ${moment(capturedAt).format('hh:mm:ss A')}`,
  ].join('\n');
};

/**
 * Permanently burns location and capture time into a photo.
 * Throws when marking fails so callers never silently save an unwatermarked
 * camera image.
 */
export const applyLocationWatermark = async (
  imageUri: string,
  location?: WatermarkLocation,
  imageSize?: WatermarkImageSize,
): Promise<string> => {
  if (!imageUri) {
    throw new Error('A camera image is required for watermarking.');
  }

  const capturedAt = new Date();
  const resolved = await getWatermarkLocation(location);
  const mapTileUri = await getMapTile(resolved.latitude, resolved.longitude);
  if (!mapTileUri) {
    throw new Error(
      'The location map could not be loaded. Check the internet connection and try again.',
    );
  }
  const text = [
    `Location: ${wrapText(resolved.address)}`,
    `Lat: ${resolved.latitude.toFixed(7)} | Lng: ${resolved.longitude.toFixed(
      7,
    )}`,
    `${moment(capturedAt).format('DD-MMM-YYYY')}  ${moment(capturedAt).format(
      'hh:mm:ss A',
    )}`,
  ].join('\n');
  const detailsOffset = MAP_SIZE + CARD_INSET * 3;
  const watermarks: WatermarkLayer[] = [
    {
      type: 'text',
      text: '·\n·\n·\n·\n·\n·',
      position: {
        position: Position.bottomLeft,
      },
      style: {
        color: '#00000000',
        fontSize: 17,
        textBackgroundStyle: {
          padding: 6,
          type: TextBackgroundType.stretchX,
          color: '#5B5B5BA6',
        },
      },
    },
  ];

  watermarks.push({
    type: 'image',
    src: {uri: mapTileUri},
    scale: MAP_SCALE,
    position: {
      position: Position.bottomLeft,
      X: CARD_INSET,
      Y: CARD_INSET,
    },
  });

  watermarks.push({
    type: 'text',
    text,
    position: {
      position: Position.bottomLeft,
      X: detailsOffset,
      Y: 12,
    },
    style: {
      color: COLORS.WHITE,
      fontSize: 16,
      fontName: FONTS.REGULAR,
      shadowStyle: {
        dx: 1,
        dy: 1,
        radius: 1,
        color: '#000000',
      },
    },
  });

  const sourceWidth = Number(imageSize?.width);
  const sourceHeight = Number(imageSize?.height);
  const sourceMaxDimension = Math.max(sourceWidth, sourceHeight);
  const processingScale =
    Number.isFinite(sourceMaxDimension) && sourceMaxDimension > 0
      ? Math.min(1, MAX_WATERMARK_IMAGE_DIMENSION / sourceMaxDimension)
      : 1;
  const processingSource = {
    uri: imageUri,
    ...(Number.isFinite(sourceWidth) &&
    sourceWidth > 0 &&
    Number.isFinite(sourceHeight) &&
    sourceHeight > 0
      ? {
          width: Math.max(1, Math.round(sourceWidth * processingScale)),
          height: Math.max(1, Math.round(sourceHeight * processingScale)),
        }
      : {}),
  };

  const markedPath = await ImageMarker.mark({
    backgroundImage: {
      src: processingSource,
      scale: 1,
    },
    watermarks,
    quality: 85,
    filename: `GTPL_${moment(capturedAt).format('YYYYMMDD_HHmmss_SSS')}`,
    saveFormat: ImageFormat.jpg,
  });

  return withFileScheme(markedPath);
};

/**
 * Final safety guard for upload paths. Camera screens normally watermark as
 * soon as a photo is captured; this also catches any raw URI that reaches an
 * API payload through a legacy or alternate capture flow.
 */
export const ensureLocationWatermark = async (
  imageUri: string,
  location?: WatermarkLocation,
): Promise<string> =>
  isLocationWatermarked(imageUri)
    ? imageUri
    : applyLocationWatermark(imageUri, location);
