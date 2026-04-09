/*
 @ 𝔸𝕦𝕥𝕙𝕠𝕣: ℙ𝕒𝕟𝕜𝕒𝕛 𝕂𝕦𝕞𝕒𝕣 ℙ𝕣𝕒𝕛𝕡𝕒𝕥𝕚
 @ 𝔼𝕞𝕒𝕚𝕝: 𝕡𝕜𝕡𝕣𝕒𝕛𝕡𝕒𝕥𝕚𝟙𝟙𝟡𝟡𝟟@𝕘𝕞𝕒𝕚𝕝.𝕔𝕠𝕞
 @
 @ iOS OTP Auto-fetch Fix Notes:
 @ ─────────────────────────────────────────────────────────────────
 @ PROBLEM: iOS autofill via `textContentType: 'oneTimeCode'` requires
 @   the TextInput to be EDITABLE. Setting `editable: false` silently
 @   disables the iOS QuickType / SMS suggestion bar entirely.
 @
 @ FIX APPLIED:
 @   1. On iOS: field is editable=true so the OTP suggestion bar appears.
 @   2. On Android: field stays editable=false (SMS listener handles fill).
 @   3. `showSoftInputOnFocus` is true on iOS so the suggestion bar renders.
 @   4. `onFilled` now correctly triggers verifyOtp on iOS (smsFilledRef
 @      is only set on Android, so the guard won't block iOS).
 @   5. APNs token retry loop improved — no longer blocks verify.
 @   6. Removed the `tokenStatus` debug overlay from production view
 @      (kept behind __DEV__ flag).
 @ ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
const OtpVerification: FC<ScreenProps.OtpVerification> = ({
  navigation,
  route,
  loading,
}) => {
  const {t} = useTranslation();
  const params = route?.params ?? ({} as any);

  const userIdRef = useRef<string>(params.userId ?? '');
  const passwordRef = useRef<string>(params.password ?? '');
  const appTypeRef = useRef<string>(params.appType ?? '');
  const organizationCodeRef = useRef<string>(params.organizationCode ?? '');

  const [otpCode, setOtp] = useState('');
  const [resendDisabled, setResendDisabled] = useState(false);
  const [timerCount, setTimerCount] = useState(0);

  const dispatch = useDispatch<StoreDispatch>();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const otpRef = useRef<OtpInputRef | null>(null);

  const isVerifyingRef = useRef(false);
  const submittedCodeRef = useRef('');
  // smsFilledRef is ONLY used on Android to skip the duplicate onFilled call
  const smsFilledRef = useRef(false);
  const listenerStartedRef = useRef(false);
  const fcmTokenRef = useRef<string | null>(null);
  const apnsTokenRef = useRef<string | null>(null);
  const deviceTypeRef = useRef<string>('');
  const appHashRef = useRef<string>('');
  const cleanupOtpListenerRef = useRef<(() => void) | null>(null);
  const tokenRefreshUnsubRef = useRef<(() => void) | null>(null);

  // ─────────────────────────────────────────────
  // INIT — device ID
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
  // FCM / APNs TOKEN SETUP
  // ─────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const initPush = async () => {
      try {
        // Register + permissions
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

        // iOS: grab APNs token (best-effort, non-blocking)
        if (Platform.OS === 'ios') {
          // Poll for APNs token — it can arrive a few seconds after launch
          (async () => {
            for (let i = 0; i < 20; i++) {
              if (!mounted) return;
              try {
                const apns = await (messaging() as any).getAPNSToken?.();
                if (apns) {
                  apnsTokenRef.current = apns;
                  if (__DEV__)
                    console.log('✅ APNs token acquired on attempt', i + 1);
                  break;
                }
              } catch {}
              await new Promise(r => setTimeout(r, 500));
            }
          })();
        }

        // FCM token
        const token = await messaging().getToken();
        if (mounted && token) {
          fcmTokenRef.current = token;
          if (__DEV__) console.log('✅ FCM token acquired');
        }

        // Listen for token refresh
        tokenRefreshUnsubRef.current = messaging().onTokenRefresh(newToken => {
          if (!mounted) return;
          fcmTokenRef.current = newToken;
        });
      } catch (err) {
        if (__DEV__) console.warn('[Push] initPush error', err);
      }
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
  // ENSURE FCM TOKEN (called just before verify)
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
          }
        }
        const token = await messaging().getToken();
        if (token) {
          fcmTokenRef.current = token;
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
    if (__DEV__)
      console.log(`🔍 verifyOtp | source: ${source} | code: ${code}`);

    if (isVerifyingRef.current) {
      if (__DEV__) console.log('🚫 Blocked — in-flight');
      return;
    }
    if (submittedCodeRef.current === code) {
      if (__DEV__) console.log('🚫 Blocked — duplicate code');
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
        console.log('📦 otp:', payload.otp);
      }

      const result: any = await dispatch(verifyOtpApi(payload));
      if (result?.error || result?.payload?.status !== 200) {
        if (__DEV__) console.log('❌ Verify failed — reset for retry');
        submittedCodeRef.current = '';
        smsFilledRef.current = false;
      } else {
        if (__DEV__) console.log('✅ Verify success');
      }
    } catch (err) {
      if (__DEV__) console.log('❌ Verify exception:', err);
      submittedCodeRef.current = '';
      smsFilledRef.current = false;
    } finally {
      isVerifyingRef.current = false;
    }
  };

  // ─────────────────────────────────────────────
  // OTP EXTRACTOR (Android SMS)
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
      if (__DEV__) console.log('ℹ️ SMS listener already active');
      return;
    }

    let OtpVerify: OtpVerifyModule = null;
    try {
      OtpVerify = require('react-native-otp-verify');
    } catch {
      if (__DEV__) console.log('⚠️ react-native-otp-verify not available');
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

        if (__DEV__) console.log('📱 SMS OTP:', code);

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
        if (__DEV__) console.log('📱 Resuming — re-arming SMS listener');
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
  // iOS: is the field editable?
  // Android: editable=false — SMS listener fills it programmatically.
  // iOS:     editable=true  — required for `textContentType: 'oneTimeCode'`
  //          to show the OTP suggestion in the QuickType bar.
  // ─────────────────────────────────────────────
  const isIOS = Platform.OS === 'ios';

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

          {/* DEV-only token debug */}
          {__DEV__ && isIOS && (
            <Text style={styles.tokenStatus}>
              {`APNs: ${apnsTokenRef.current ? '✓' : '…'} · FCM: ${
                fcmTokenRef.current ? '✓' : '…'
              }`}
            </Text>
          )}

          {/* OTP Input */}
          <View style={styles.inputContainer}>
            <OtpInput
              ref={otpRef}
              numberOfDigits={6}
              focusColor={COLORS.PRIMARY}
              // iOS: autoFocus=true so the QuickType bar with OTP appears immediately
              autoFocus={isIOS}
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
                if (Platform.OS === 'android') {
                  // Android: SMS listener already called verifyOtp — skip duplicate
                  if (smsFilledRef.current) {
                    if (__DEV__)
                      console.log(
                        '⏭️ onFilled skipped — Android SMS already triggered verify',
                      );
                    smsFilledRef.current = false;
                    return;
                  }
                  // Fallback for Android if SMS listener missed it
                  if (code?.length === 6) {
                    verifyOtp(code, 'android_fallback_onFilled');
                  }
                } else {
                  // ─────────────────────────────────────────────
                  // iOS: This is the PRIMARY verify path.
                  // The user taps the OTP suggestion in the QuickType bar
                  // → iOS fills the field → onFilled fires → we verify.
                  // ─────────────────────────────────────────────
                  if (code?.length === 6) {
                    if (__DEV__)
                      console.log('🍎 iOS onFilled — triggering verify');
                    verifyOtp(code, 'ios_autofill');
                  }
                }
              }}
              textInputProps={{
                accessibilityLabel: 'One-Time Password',

                // ─── KEY iOS FIX ──────────────────────────────────────────
                // editable MUST be true on iOS so the QuickType / OTP
                // suggestion bar is shown by the system. Setting it to false
                // silently disables the whole autofill mechanism.
                // On Android we keep it false so users cannot type manually
                // (SMS auto-fill handles everything there).
                // ─────────────────────────────────────────────────────────
                editable: isIOS ? true : false,

                // showSoftInputOnFocus must be true on iOS so the keyboard
                // (and more importantly the OTP suggestion bar above it) appears.
                showSoftInputOnFocus: isIOS ? true : false,

                caretHidden: !isIOS,
                keyboardType: 'number-pad',
                returnKeyType: 'done',
                blurOnSubmit: true,

                // These two are the magic for iOS SMS OTP autofill:
                autoComplete: isIOS ? 'one-time-code' : 'off',
                textContentType: isIOS ? 'oneTimeCode' : 'none',
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

          {/* iOS hint */}
          {isIOS && (
            <View style={styles.otpLoader}>
              <Text style={styles.waitingText}>
                Tap the OTP suggestion above the keyboard
              </Text>
            </View>
          )}

          {/* Android SMS waiting indicator */}
          {ENABLE_AUTO_SMS && Platform.OS === 'android' && (
            <View style={styles.otpLoader}>
              <Text style={styles.waitingText}>
                Waiting for OTP to Auto fill
              </Text>
            </View>
          )}

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
