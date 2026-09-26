/*
 @ 𝔸𝕦𝕥𝕙𝕠𝕣: ℙ𝕒𝕟𝕜𝕒𝕛 𝕂𝕦𝕞𝕒𝕣 ℙ𝕣𝕒𝕛𝕡𝕒𝕥𝕚
 @ 𝔼𝕞𝕒𝕚𝕝: 𝕡𝕜𝕡𝕣𝕒𝕛𝕡𝕒𝕥𝕚𝟙𝟙𝟡𝟡𝟟@𝕘𝕞𝕒𝕚𝕝.𝕔𝕠𝕞
*/
import {InputField} from '@atoms';
import {AuthScreen} from '@organisms';
import {useFocusEffect} from '@react-navigation/native';
import {RootState, StoreDispatch} from '@reducers';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {getOtpApi, verifyOtpApi} from '@slices/login.slice';
import {ScreenProps} from '@types';
import {Common} from '@utils';
import React, {FC, useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  ImageBackground,
  View,
  AppState,
  Keyboard,
  TextInput,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {OtpInput, OtpInputRef} from 'react-native-otp-entry';
import {connect, useDispatch} from 'react-redux';
import messaging from '@react-native-firebase/messaging';
// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type OtpVerifyModule = {
  getHash?: () => Promise<string[]>;
  startOtpListener?: (cb: (message: string) => void) => void;
  removeListener?: () => void;
  getOtp?: () => Promise<void>;
} | null;
const ENABLE_AUTO_SMS = true;
// const ENABLE_AUTO_SMS = false;

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
const OtpVerification: FC<ScreenProps.OtpVerification> = ({
  route,
  loading,
}) => {
  const {t} = useTranslation();
  const params = route?.params ?? ({} as any);

  const userIdRef = useRef<string>(params.userId ?? '');
  const passwordRef = useRef<string>(params.password ?? '');
  const appTypeRef = useRef<string>(params.appType ?? '');
  const organizationCodeRef = useRef<string>(params.organizationCode ?? '');

  const [, setOtp] = useState('');
  const [resendDisabled, setResendDisabled] = useState(false);
  const [timerCount, setTimerCount] = useState(0);
  const [apnsStatus, setApnsStatus] = useState<'pending' | 'ok'>('pending');
  const [fcmStatus, setFcmStatus] = useState<'pending' | 'ok'>('pending');

  const dispatch = useDispatch<StoreDispatch>();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const otpRef = useRef<OtpInputRef | null>(null);

  const isVerifyingRef = useRef(false);
  const submittedCodeRef = useRef('');
  const smsFilledRef = useRef(false);
  const listenerStartedRef = useRef(false);
  const fcmTokenRef = useRef<string | null>(null);
  const apnsTokenRef = useRef<string | null>(null);
  const deviceTypeRef = useRef<string>('');
  const appHashRef = useRef<string>('');
  const cleanupOtpListenerRef = useRef<(() => void) | null>(null);
  const tokenRefreshUnsubRef = useRef<(() => void) | null>(null);

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const id = await Promise.resolve(DeviceInfo.getDeviceId());
        deviceTypeRef.current = `${Platform.OS}-${id}`;
      } catch {
        deviceTypeRef.current = Platform.OS;
      }
    };
    init();
  }, []);

  // ─────────────────────────────────────────────
  // FCM TOKEN SETUP
  // ─────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const initPush = async () => {
      try {
        try {
          await messaging().registerDeviceForRemoteMessages();
        } catch {}
        try {
          await messaging().setAutoInitEnabled(true);
        } catch {}
        try {
          await messaging().requestPermission({
            provisional: true,
            alert: true,
            badge: true,
            sound: true,
          });
        } catch {}

        if (Platform.OS === 'ios') {
          try {
            const apns = await (messaging() as any).getAPNSToken?.();
            if (mounted && apns) {
              apnsTokenRef.current = apns;
              setApnsStatus('ok');
            }
          } catch {}
        } else {
          setApnsStatus('ok');
        }

        const token = await messaging().getToken();
        if (mounted && token) {
          fcmTokenRef.current = token;
          setFcmStatus('ok');
        }

        tokenRefreshUnsubRef.current = messaging().onTokenRefresh(newToken => {
          if (!mounted) return;
          fcmTokenRef.current = newToken;
          setFcmStatus('ok');
        });
      } catch {}
    };

    initPush();

    return () => {
      mounted = false;
      try {
        tokenRefreshUnsubRef.current?.();
      } catch {}
      tokenRefreshUnsubRef.current = null;
    };
  }, []);

  // ─────────────────────────────────────────────
  // ENSURE FCM TOKEN
  // ─────────────────────────────────────────────
  const ensureFcmToken = async (): Promise<string | null> => {
    if (fcmTokenRef.current) return fcmTokenRef.current;

    try {
      await messaging().registerDeviceForRemoteMessages();
    } catch {}
    try {
      await messaging().setAutoInitEnabled(true);
    } catch {}

    for (let i = 0; i < 12; i++) {
      try {
        if (Platform.OS === 'ios') {
          const apns = await (messaging() as any).getAPNSToken?.();
          if (apns && !apnsTokenRef.current) {
            apnsTokenRef.current = apns;
            setApnsStatus('ok');
          }
        }
        const token = await messaging().getToken();
        if (token) {
          fcmTokenRef.current = token;
          setFcmStatus('ok');
          return token;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
    return null;
  };

  // ─────────────────────────────────────────────
  // TIMER
  // ─────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      startCountdown();
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, []),
  );

  const startCountdown = () => {
    setTimerCount(90);
    setResendDisabled(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    intervalRef.current = setInterval(() => {
      setTimerCount(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  // ─────────────────────────────────────────────
  // CORE VERIFY
  // ─────────────────────────────────────────────
  const verifyOtp = async (code: string, source: string = 'unknown') => {
    console.log(`🔍 verifyOtp | source: ${source} | code: ${code}`);

    if (isVerifyingRef.current) {
      console.log('🚫 Blocked — in-flight');
      return;
    }
    if (submittedCodeRef.current === code) {
      console.log('🚫 Blocked — duplicate code');
      return;
    }
    if (!code || code.length !== 6) {
      Common.showToast(
        code ? t('validation.invalid_otp') : t('validation.wait_for_otp'),
      );
      return;
    }

    const token = await ensureFcmToken();
    if (!token) {
      Common.showToast('Push token not ready, please try again');
      return;
    }

    isVerifyingRef.current = true;
    submittedCodeRef.current = code;

    try {
      const payload = {
        userId: userIdRef.current,
        password: passwordRef.current,
        appType: appTypeRef.current,
        hashKey: appHashRef.current,
        organizationCode: organizationCodeRef.current,
        otp: code,
        deviceToken: token,
        deviceType: deviceTypeRef.current,
      };

      if (__DEV__) {
        console.log('📦 Payload keys:', Object.keys(payload).join(', '));
        console.log('📦 userId:', payload.userId);
        console.log('📦 appType:', payload.appType);
        console.log('📦 organizationCode:', payload.organizationCode);
        console.log('📦 hashKey:', payload.hashKey);
        console.log('📦 deviceType:', payload.deviceType);
        console.log(
          '📦 deviceToken (first 20):',
          payload.deviceToken.slice(0, 20),
        );
        console.log(
          '📦 password (pre-encrypted, first 20):',
          payload.password?.slice(0, 20),
        );
        console.log('📦 otp (plain, slice will encrypt):', payload.otp);
      }

      const result: any = await dispatch(verifyOtpApi(payload));
      if (result?.error || result?.payload?.status !== 200) {
        console.log('❌ Verify failed — reset for retry');
        submittedCodeRef.current = '';
        smsFilledRef.current = false;
      } else {
        console.log('✅ Verify success');
      }
    } catch (err) {
      console.log('❌ Verify exception:', err);
      submittedCodeRef.current = '';
      smsFilledRef.current = false;
    } finally {
      isVerifyingRef.current = false;
    }
  };

  // ─────────────────────────────────────────────
  // OTP EXTRACTOR
  // ─────────────────────────────────────────────
  const extractOTP = (message: string): string | null => {
    const m = message.match(/(^|[^0-9])([0-9]{6})(?![0-9])/);
    return m ? m[2] : null;
  };

  // ─────────────────────────────────────────────
  // ANDROID SMS LISTENER
  // ─────────────────────────────────────────────
  const startAndroidOtpPipelines = async () => {
    if (!ENABLE_AUTO_SMS || Platform.OS !== 'android') return;

    if (listenerStartedRef.current) {
      console.log('ℹ️ SMS listener already active');
      return;
    }

    let OtpVerify: OtpVerifyModule = null;
    try {
      OtpVerify = require('react-native-otp-verify');
    } catch {
      console.log('⚠️ react-native-otp-verify not available');
      return;
    }
    if (!OtpVerify) return;

    try {
      const hashes = (await OtpVerify.getHash?.()) ?? [];
      if (hashes.length) {
        appHashRef.current = encodeURIComponent(hashes[0]);
        if (__DEV__) console.log('🔐 Hash:', appHashRef.current);
      }
    } catch (err) {
      if (__DEV__) console.warn('[OTP] getHash failed', err);
    }

    try {
      OtpVerify.startOtpListener?.((msg: string) => {
        const code = extractOTP(msg);
        if (!code) return;

        console.log('📱 SMS OTP:', code);

        // Mark BEFORE setValue so onFilled skips its own verify call
        smsFilledRef.current = true;
        setOtp(code);

        const anyRef = otpRef.current as any;
        if (anyRef?.setValue) {
          anyRef.setValue(code);
        }

        // Single verify call from SMS
        verifyOtp(code, 'android_sms');
      });

      listenerStartedRef.current = true;
      cleanupOtpListenerRef.current = () => {
        try {
          OtpVerify?.removeListener?.();
        } catch {}
        listenerStartedRef.current = false;
      };
    } catch (err) {
      if (__DEV__) console.warn('[OTP] startOtpListener failed', err);
    }

    try {
      await OtpVerify.getOtp?.();
    } catch {}
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    startAndroidOtpPipelines();
    return () => {
      cleanupOtpListenerRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && !listenerStartedRef.current) {
        console.log('📱 Resuming — re-arming SMS listener');
        startAndroidOtpPipelines();
      }
    });
    return () => sub.remove();
  }, []);

  // ─────────────────────────────────────────────
  // RESEND OTP
  // ─────────────────────────────────────────────
  const resendOtp = () => {
    isVerifyingRef.current = false;
    submittedCodeRef.current = '';
    smsFilledRef.current = false;

    startCountdown();

    dispatch(
      getOtpApi({
        mobileNumber: userIdRef.current,
        hashKey: appHashRef.current,
        organizationCode: organizationCodeRef.current,
      }),
    );

    try {
      (otpRef.current as any)?.clear?.();
    } catch {}
    setOtp('');
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <AuthScreen
      preset="scroll"
      loading={loading}
      statusBgColor={COLORS.BACKGROUND_DEFAULT}
      statusBarStyle={'dark'}
      fixedBottomComponent={
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Powered by @Gigatel</Text>
        </View>
      }>
      <ImageBackground
        source={IMAGES.bkgImage}
        resizeMode="cover"
        style={styles.background}>
        <View>
          {/* Header */}
          <View style={[styles.header, styles.center]}>
            <Text style={styles.title2}>GigaMatrix</Text>

            <Image source={IMAGES.appLogo} style={styles.logo} />
            <Text style={styles.title}>Login to your Account</Text>
            <Text style={styles.subtitle}>Fill the details to login</Text>
          </View>

          {/* Static fields */}
          <View style={styles.form}>
            <TextInput
              style={styles.ispInput}
              placeholder="Enter ISP ID"
              value={organizationCodeRef.current}
              editable={false}
              placeholderTextColor={'#393d45'}
            />
            <InputField
              type="loginMobile"
              value={userIdRef.current}
              placeholder="Enter phone no."
              maxLength={10}
              keyboardType="number-pad"
              editable={false}
              onEndEditing={Keyboard.dismiss}
              inputStyle={{height: SIZE.MVS(45)}}
            />
          </View>
          {/* iOS token debug */}
          {Platform.OS === 'ios' && (
            <Text style={styles.tokenStatus}>
              {`APNs: ${apnsStatus === 'ok' ? '✓' : '…'} · FCM: ${
                fcmStatus === 'ok' ? '✓' : '…'
              }`}
            </Text>
          )}
          {/* OTP Input */}
          <View style={styles.inputContainer} pointerEvents="none">
            <OtpInput
              ref={otpRef}
              numberOfDigits={6}
              focusColor={COLORS.PRIMARY}
              autoFocus={false}
              hideStick
              placeholder="＊＊＊＊＊＊"
              blurOnFilled={true}
              type="numeric"
              secureTextEntry={false}
              focusStickBlinkingDuration={500}
              onTextChange={text => {
                setOtp(text);
              }}
              onFilled={code => {
                // SMS already handled → skip (prevents double call)
                if (smsFilledRef.current) {
                  console.log(
                    '⏭️ onFilled skipped — SMS already triggered verify',
                  );
                  smsFilledRef.current = false;
                  return;
                }
                if (code?.length === 6) {
                  console.log('📝 onFilled — fallback');
                  verifyOtp(code, 'fallback_onFilled');
                }
              }}
              textInputProps={{
                accessibilityLabel: 'One-Time Password',
                editable: false,
                showSoftInputOnFocus: false,
                caretHidden: true,
                contextMenuHidden: true,
                selectTextOnFocus: false,
                keyboardType: 'number-pad',
                returnKeyType: 'done',
                blurOnSubmit: true,
                autoComplete: Platform.OS === 'ios' ? 'one-time-code' : 'off',
                textContentType: Platform.OS === 'ios' ? 'oneTimeCode' : 'none',
              }}
              theme={{
                containerStyle: styles.otpContainer,
                pinCodeContainerStyle: styles.pinBox,
                pinCodeTextStyle: styles.pinCodeText,
                placeholderTextStyle: styles.placeholderText,
                filledPinCodeContainerStyle: styles.filledPinCodeContainer,
              }}
            />
          </View>

          {/* Resend */}
          <View style={styles.resendContainer}>
            <Text
              style={[styles.resendText, resendDisabled && {opacity: 0.5}]}
              onPress={!resendDisabled ? resendOtp : undefined}>
              {resendDisabled ? t('resend_after') : t('resend_code')}{' '}
              {timerCount > 0 && (
                <Text style={styles.timerText}>{timerCount}</Text>
              )}
              {resendDisabled ? ' sec' : ''}
            </Text>
          </View>

          {/* SMS waiting indicator */}
          {ENABLE_AUTO_SMS && Platform.OS === 'android' && (
            <View style={styles.otpLoader}>
              <Text style={styles.waitingText}>
                Waiting for OTP to Auto fill
              </Text>
            </View>
          )}
        </View>
      </ImageBackground>
    </AuthScreen>
  );
};

// ─────────────────────────────────────────────
// Redux
// ─────────────────────────────────────────────
const MapStateToProps = (state: RootState) => ({
  loading: state.login.loading === 'pending',
});

export default connect(MapStateToProps)(OtpVerification);

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  tokenStatus: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MVS(11),
    color: COLORS.ERROR,
    marginHorizontal: SIZE.MS(15),
    textAlign: 'center',
    marginTop: SIZE.MS(8),
  },
  waitingText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MVS(13),
    color: COLORS.PRIMARY_DARK,
    textAlign: 'center',
  },
  otpLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SIZE.MS(10),
  },
  filledPinCodeContainer: {
    borderColor: COLORS.BORDER_DEFAULT,
  },
  timerText: {
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
    fontSize: SIZE.MVS(15),
    color: COLORS.ERROR,
  },
  pinCodeText: {
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
    fontSize: SIZE.MS(12),
    color: COLORS.TEXT_DARK,
  },
  placeholderText: {
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
    fontSize: SIZE.MS(14),
    color: COLORS.TEXT_PLACEHOLDER,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SIZE.MS(10),
    gap: SIZE.MS(6),
  },
  resendText: {
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
    fontSize: SIZE.MVS(15),
    color: 'purple',
  },
  inputContainer: {
    marginTop: SIZE.MS(15),
    alignItems: 'center',
  },
  background: {
    flex: 1,
    width: '100%',
  },
  pinBox: {
    width: SIZE.MS(45),
    height: SIZE.MS(48),
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.BORDER_DEFAULT,
    backgroundColor: COLORS.WHITE,
  },
  otpContainer: {
    width: '78%',
    alignSelf: 'center',
  },
  footerContainer: {
    position: 'absolute',
    bottom: SIZE.MS(12),
    right: SIZE.MS(20),
  },
  footerText: {
    fontSize: SIZE.MS(13),
    fontFamily: FONTS.SEMI_BOLD,
    fontWeight: FONTS.FONT_WEIGHT.SEMI_BOLD,
    color: '#19191A',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginTop: Platform.OS === 'ios' ? SIZE.MVS(150) : SIZE.MS(85),
    gap: 12,
  },
  logo: {
    width: 41,
    height: 41,
    resizeMode: 'contain',
  },
  title: {
    fontSize: SIZE.MS(24),
    fontFamily: FONTS.SEMI_BOLD,
    fontWeight: FONTS.FONT_WEIGHT.SEMI_BOLD,
    lineHeight: 42,
    textAlign: 'center',
    color: '#19191a',
  },
  title2: {
    fontSize: SIZE.MS(28),
    fontFamily: FONTS.SEMI_BOLD,
    fontWeight: FONTS.FONT_WEIGHT.SEMI_BOLD,
    lineHeight: 42,
    textAlign: 'center',
    color: COLORS.PRIMARY,
  },
  subtitle: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  form: {
    marginTop: SIZE.MS(50),
    gap: 15,
  },
  ispInput: {
    flexDirection: 'row',
    width: '80%',
    alignSelf: 'center',
    borderRadius: 45,
    paddingHorizontal: 19,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 6,
    height: 46,
    paddingVertical: 0,
    backgroundColor: COLORS.colorWhite,
    borderColor: 'transparent',
    borderStyle: 'solid',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
});
