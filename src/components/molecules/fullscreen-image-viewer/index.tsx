import React, {FC, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {COLORS, FONTS, SIZE} from '@res';
import {Preferences} from '@utils';

type Props = {
  visible: boolean;
  images: string[];
  index: number;
  title?: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

const ViewerImage: FC<{uri: string; width: number; height: number}> = ({
  uri,
  width,
  height,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [useBrowserFallback, setUseBrowserFallback] = useState(false);
  const [loadError, setLoadError] = useState('');
  const browserFailedRef = useRef(false);
  const authToken = Preferences.getData('API_AUTH_TOKEN');
  const requestHeaders = authToken
    ? {Authorization: `Bearer ${String(authToken)}`}
    : undefined;

  useEffect(() => {
    setIsLoading(true);
    setUseBrowserFallback(false);
    setLoadError('');
    browserFailedRef.current = false;
  }, [uri]);

  useEffect(() => {
    if (!isLoading || useBrowserFallback || !/^https?:\/\//i.test(uri)) {
      return;
    }

    // Some Android image requests neither finish nor emit onError. Move to
    // the browser renderer instead of leaving the user on an endless loader.
    const timer = setTimeout(() => setUseBrowserFallback(true), 5000);
    return () => clearTimeout(timer);
  }, [isLoading, uri, useBrowserFallback]);

  useEffect(() => {
    if (!isLoading || !useBrowserFallback) {
      return;
    }

    const timer = setTimeout(() => {
      setIsLoading(false);
      setLoadError('Unable to load this image from the server.');
    }, 15000);
    return () => clearTimeout(timer);
  }, [isLoading, useBrowserFallback]);

  return (
    <View style={{width, height}}>
      {useBrowserFallback && /^https?:\/\//i.test(uri) ? (
        <WebView
          source={{uri, headers: requestHeaders}}
          originWhitelist={['*']}
          mixedContentMode="always"
          javaScriptEnabled
          scrollEnabled={false}
          pointerEvents="none"
          injectedJavaScript={`
            document.documentElement.style.backgroundColor = '#050506';
            document.body.style.margin = '0';
            document.body.style.backgroundColor = '#050506';
            document.body.style.width = '100vw';
            document.body.style.height = '100vh';
            document.body.style.display = 'flex';
            document.body.style.alignItems = 'center';
            document.body.style.justifyContent = 'center';
            var image = document.querySelector('img');
            if (image) {
              image.style.maxWidth = '100%';
              image.style.maxHeight = '100%';
              image.style.objectFit = 'contain';
            }
            true;
          `}
          onLoadStart={() => {
            browserFailedRef.current = false;
          }}
          onLoadEnd={() => {
            setIsLoading(false);
            if (!browserFailedRef.current) {
              setLoadError('');
            }
          }}
          onError={event => {
            browserFailedRef.current = true;
            setIsLoading(false);
            setLoadError(
              event.nativeEvent.description ||
                'Unable to load this image from the server.',
            );
          }}
          onHttpError={event => {
            browserFailedRef.current = true;
            setIsLoading(false);
            setLoadError(`Image server returned ${event.nativeEvent.statusCode}.`);
          }}
          style={styles.browserImage}
        />
      ) : (
        <Image
          source={{uri, headers: requestHeaders}}
          resizeMode="contain"
          onLoadEnd={() => setIsLoading(false)}
          onError={event => {
            console.warn('[FullscreenImageViewer] Native image load failed', {
              uri,
              error: event.nativeEvent.error,
            });
            setUseBrowserFallback(true);
          }}
          style={styles.image}
        />
      )}
      {isLoading ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.WHITE} />
        </View>
      ) : null}
      {loadError ? (
        <View pointerEvents="none" style={styles.errorOverlay}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : null}
    </View>
  );
};

const FullscreenImageViewer: FC<Props> = ({
  visible,
  images,
  index,
  title = 'Image Preview',
  onIndexChange,
  onClose,
}) => {
  const listRef = useRef<FlatList<string>>(null);
  const {width, height} = useWindowDimensions();
  const safeIndex = Math.min(
    Math.max(index, 0),
    Math.max(images.length - 1, 0),
  );

  useEffect(() => {
    if (!visible || images.length === 0) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({index: safeIndex, animated: false});
    });
    return () => cancelAnimationFrame(frame);
  }, [images.length, safeIndex, visible, width]);

  const updateIndexAfterSwipe = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (nextIndex >= 0 && nextIndex < images.length && nextIndex !== index) {
      onIndexChange(nextIndex);
    }
  };

  return (
    <Modal
      visible={visible && images.length > 0}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          bounces={false}
          initialScrollIndex={safeIndex}
          keyExtractor={(uri, itemIndex) => `${uri}-${itemIndex}`}
          getItemLayout={(_, itemIndex) => ({
            length: width,
            offset: width * itemIndex,
            index: itemIndex,
          })}
          onMomentumScrollEnd={updateIndexAfterSwipe}
          onScrollToIndexFailed={({index: failedIndex}) =>
            listRef.current?.scrollToOffset({
              offset: failedIndex * width,
              animated: false,
            })
          }
          showsHorizontalScrollIndicator={false}
          renderItem={({item}) => (
            <ViewerImage uri={item} width={width} height={height} />
          )}
        />

        <View style={styles.header} pointerEvents="box-none">
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Close image viewer"
            hitSlop={{top: 10, right: 10, bottom: 10, left: 10}}
            onPress={onClose}
            style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer} pointerEvents="none">
          <Text style={styles.counter}>
            {safeIndex + 1} of {images.length}
          </Text>
          {images.length > 1 ? (
            <Text style={styles.hint}>Swipe to view next image</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#050506'},
  image: {width: '100%', height: '100%'},
  browserImage: {flex: 1, backgroundColor: '#050506'},
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZE.MS(32),
  },
  errorText: {
    color: COLORS.WHITE,
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(13),
    lineHeight: SIZE.MS(19),
    textAlign: 'center',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'android' ? SIZE.MVS(38) : SIZE.MVS(52),
    left: SIZE.MS(18),
    right: SIZE.MS(18),
    zIndex: 2,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    marginRight: SIZE.MS(12),
    color: COLORS.WHITE,
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MS(14),
  },
  closeButton: {
    width: SIZE.MS(42),
    height: SIZE.MS(42),
    borderRadius: SIZE.MS(21),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(35,35,38,0.9)',
  },
  closeText: {
    color: COLORS.WHITE,
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(30),
    lineHeight: SIZE.MS(32),
  },
  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? SIZE.MVS(30) : SIZE.MVS(42),
    left: SIZE.MS(20),
    right: SIZE.MS(20),
    zIndex: 2,
    alignItems: 'center',
  },
  counter: {
    color: COLORS.WHITE,
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MS(12),
  },
  hint: {
    marginTop: SIZE.MVS(5),
    color: 'rgba(255,255,255,0.76)',
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(10),
  },
});

export default FullscreenImageViewer;
