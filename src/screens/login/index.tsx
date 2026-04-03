import React, {useEffect, useState} from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  Animated,
  Dimensions,
  Text,
  View,
  TextInput,
  ImageBackground,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {connect, useDispatch} from 'react-redux';
import OTPVerify from 'react-native-otp-verify';
import * as Animatable from 'react-native-animatable';
import {Buttons, InputField} from '@atoms';
import {AuthScreen} from '@organisms';
import {RootState, StoreDispatch} from '@reducers';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {getOtpApi} from '@slices/login.slice';
import {ScreenProps} from '@types';
import {BoxShadow} from '../../res/globalStyle';
import {Common, Location} from '@utils';

const Login: React.FC<ScreenProps.Login> = ({loading}) => {
  const {t} = useTranslation();
  const dispatch = useDispatch<StoreDispatch>();
  const {width, height} = Dimensions.get('window');
  const circleScale = Math.sqrt(width * width + height * height) / 10;

  const [mobileNumber, setMobileNumber] = useState('');
  const [organizationCode, setOrganizationCode] = useState('');

  // FLOW STATES
  const [showSplash, setShowSplash] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // ✅ KEYBOARD STATE
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // ANIMATION VALUES
  const splashScale = useState(new Animated.Value(0.1))[0];
  const splashOpacity = useState(new Animated.Value(1))[0];

  /* ================= MAIN ANIMATION FLOW ================= */
  useEffect(() => {
    Location.checkPermission();

    Animated.timing(splashScale, {
      toValue: circleScale,
      duration: 900,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setShowSplash(false);
        setShowWelcome(true);
        setTimeout(() => {
          setShowWelcome(false);
          setShowForm(true);
        }, 2200);
      });
    });
  }, []);

  /* ================= KEYBOARD LISTENERS ================= */
  useEffect(() => {
    const showEvent =
      Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow';
    const hideEvent =
      Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide';

    const showSub = Keyboard.addListener(showEvent, () =>
      setIsKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setIsKeyboardVisible(false),
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  /* ================= OTP ================= */
  const getPwdKey = async () => {
    const orgCode = organizationCode;

    if (!orgCode) {
      Common.showToast('Please enter ISP ID');
      return;
    }

    let hashKey = [''];

    if (Platform.OS === 'android') {
      try {
        hashKey = await OTPVerify.getHash();
        dispatch(
          getOtpApi({
            mobileNumber,
            organizationCode: orgCode,
            hashKey: hashKey?.[0] ? encodeURIComponent(hashKey[0]) : '',
          }),
        );
        return;
      } catch (e) {
        Common.warn('OTP hash error', e);
      }
    }

    dispatch(
      getOtpApi({
        mobileNumber,
        organizationCode: orgCode,
        hashKey: hashKey[0],
      }),
    );
  };

  const checkValidation = () => {
    Keyboard.dismiss();

    if (!organizationCode.trim()) {
      Common.showToast('Please enter ISP ID');
    } else if (!mobileNumber.trim()) {
      Common.showToast(t('validation.empty_mobile'));
    } else if (!Common.isValidMobile(mobileNumber)) {
      Common.showToast(t('validation.invalid_mobile'));
    } else {
      getPwdKey();
    }
  };

  return (
    <AuthScreen
      preset="scroll"
      loading={loading}
      statusBgColor={COLORS.BACKGROUND_DEFAULT}
      statusBarStyle="dark"
      fixedBottomComponent={
        // ✅ Footer hidden when keyboard is open
        !isKeyboardVisible ? (
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Powered by @Gigatel</Text>
          </View>
        ) : null
      }>
      <ImageBackground
        source={IMAGES.bkgImage}
        resizeMode="cover"
        style={styles.background}>
        {/* ================= SPLASH DOT ================= */}
        {showSplash && (
          <Animated.View
            style={[
              styles.splashCircle,
              {
                opacity: splashOpacity,
                transform: [{scale: splashScale}],
              },
            ]}
          />
        )}

        {/* ================= WELCOME ================= */}
        {showWelcome && (
          <Animatable.View
            animation="fadeInUp"
            duration={800}
            style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Welcome</Text>
          </Animatable.View>
        )}

        {/* ================= LOGIN FORM ================= */}
        {showForm && (
          <Animatable.View
            animation="fadeInUp"
            duration={800}
            style={styles.contentContainer}>
            <View style={[styles.header, styles.center]}>
              <Text style={styles.title2}>GigaMatrix</Text>

              <Animatable.Image
                animation="bounceIn"
                duration={900}
                source={IMAGES.appLogo}
                style={styles.logo}
              />

              <Text style={styles.title}>Login to your Account</Text>
              <Text style={styles.subtitle}>Fill the details to login</Text>
            </View>

            <View style={styles.form}>
              <TextInput
                style={styles.ispInput}
                placeholder="Enter ISP ID"
                value={organizationCode}
                onChangeText={text => setOrganizationCode(text)}
                autoCapitalize="none"
                placeholderTextColor="#19191a"
              />
              <InputField
                type="loginMobile"
                value={mobileNumber}
                placeholder="Enter phone no."
                maxLength={10}
                keyboardType="number-pad"
                onChangeText={setMobileNumber}
                onEndEditing={Keyboard.dismiss}
                inputStyle={{height: SIZE.MVS(45)}}
              />
            </View>

            <View style={styles.buttonWrapper}>
              <Buttons
                type="primary"
                title="Get OTP"
                viewStyle={styles.loginButton}
                onPress={checkValidation}
              />
            </View>
          </Animatable.View>
        )}
      </ImageBackground>
    </AuthScreen>
  );
};

const mapStateToProps = (state: RootState) => ({
  loading: state.login.loading === 'pending',
});

export default connect(mapStateToProps)(Login);

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  center: {alignItems: 'center', justifyContent: 'center'},
  background: {flex: 1, width: '100%'},

  /* SPLASH DOT */
  splashCircle: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    top: '50%',
    left: '50%',
    marginLeft: -10,
    marginTop: -10,
    zIndex: 10,
  },

  /* WELCOME */
  welcomeContainer: {
    marginTop: SIZE.MS(85),
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: SIZE.MS(39),
    lineHeight: SIZE.MS(49),
    color: COLORS.colorWhite,
    fontFamily: FONTS.REGULAR,
    fontWeight: FONTS.FONT_WEIGHT.REGULAR,
    textAlign: 'center',
    textShadowOffset: {width: 2, height: 3},
    textShadowRadius: 3,
  },

  contentContainer: {flex: 1},
  header: {
    marginTop: Platform.OS === 'ios' ? SIZE.MVS(150) : SIZE.MS(85),
    gap: 12,
  },
  logo: {width: SIZE.MS(41), height: SIZE.MS(41), resizeMode: 'contain'},
  title: {
    fontSize: SIZE.MS(24),
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.SEMI_BOLD,
    color: '#19191a',
  },
  title2: {
    fontSize: SIZE.MS(28),
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.SEMI_BOLD,
    color: COLORS.PRIMARY,
  },
  subtitle: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
    color: '#19191a',
  },
  form: {marginTop: SIZE.MS(50), gap: 15},
  ispInput: {
    width: '80%',
    alignSelf: 'center',
    borderRadius: 45,
    paddingHorizontal: 19,
    height: 46,
    backgroundColor: COLORS.colorWhite,
    elevation: 12,
    boxShadow: BoxShadow.shadow_drop,
  },
  buttonWrapper: {marginTop: SIZE.MS(20)},
  loginButton: {marginHorizontal: SIZE.MS(20)},

  footerContainer: {
    position: 'absolute',
    bottom: SIZE.MS(12),
    right: SIZE.MS(20),
  },
  footerText: {
    fontSize: SIZE.MS(13),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#19191A',
  },
});
