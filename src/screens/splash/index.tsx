import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ImageBackground,
  StatusBar,
} from 'react-native';
import {COLORS, IMAGES, SIZE, FONTS} from '@res';
import {FontSize} from '../../res/globalStyle';
const Splash = () => {
  return (
    <>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <ImageBackground
        source={IMAGES.bkgImage}
        style={styles.container}
        resizeMode="stretch">
        <View style={styles.centerContent}>
          <Image source={IMAGES.appLogo} style={styles.logo} />
        </View>
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Powered by @Gigatel</Text>
        </View>
      </ImageBackground>
    </>
  );
};
export default Splash;
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlayOne: {
    position: 'absolute',
    top: 20,
    left: -10,
    width: '40%',
    height: '100%',
  },
  overlayTwo: {
    position: 'absolute',
    top: -80,
    left: 80,
    width: '110%',
    height: '100%',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZE.MVS(20),
    paddingTop: StatusBar.currentHeight || 40,
    zIndex: 10,
  },
  logo: {
    width: '100%',
    height: SIZE.MS(60),
    resizeMode: 'contain',
    marginBottom: SIZE.MS(10),
  },
  tagline: {
    fontSize: FontSize.fs_10,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    textAlign: 'center',
    marginTop: SIZE.MS(5),
  },
  /* ---------- BOTTOM ---------- */
  bottomContainer: {
    position: 'absolute',
    bottom: SIZE.MS(24),
    width: '100%',
    alignItems: 'center',
    zIndex: 10,
  },
  footerText: {
    fontSize: SIZE.MS(13),
    fontFamily: FONTS.SEMI_BOLD,
    fontWeight: FONTS.FONT_WEIGHT.SEMI_BOLD,
    color: '#19191A',
  },
  footerContainer: {
    position: 'absolute',
    bottom: SIZE.MS(12),
    right: SIZE.MS(20),
  },
});
