import React, {
  FC,
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  AlertButton,
  AlertOptions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';

type AlertRequest = {
  title: string;
  message: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};

type AlertHandler = (
  title?: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
) => void;

type AlertBridge = {
  installed: boolean;
  nativeAlert: typeof Alert.alert;
  handler: AlertHandler | null;
};

const bridgeKey = '__GTPL_CUSTOM_ALERT_BRIDGE__';
const globalScope = globalThis as typeof globalThis & {
  [bridgeKey]?: AlertBridge;
};
const bridge: AlertBridge =
  globalScope[bridgeKey] ??
  ({
    installed: false,
    nativeAlert: Alert.alert.bind(Alert),
    handler: null,
  } as AlertBridge);

globalScope[bridgeKey] = bridge;

if (!bridge.installed) {
  Alert.alert = ((title, message, buttons, options) => {
    if (bridge.handler) {
      bridge.handler(title, message, buttons, options);
      return;
    }

    bridge.nativeAlert(title, message, buttons, options);
  }) as typeof Alert.alert;
  bridge.installed = true;
}

const getAlertVisual = (title: string, message: string) => {
  const value = `${title} ${message}`.toLowerCase();

  if (/success|successful|completed|saved|submitted|approved/.test(value)) {
    return {
      icon: IMAGES.checkFill,
      tint: COLORS.SUCCESS,
      background: '#EAF8EE',
    };
  }
  if (/camera|image|photo|picture/.test(value)) {
    return {icon: IMAGES.camera, tint: '#7445DF', background: '#F1ECFF'};
  }
  if (/location|gps|map|address|lat\/lng/.test(value)) {
    return {icon: IMAGES.location, tint: '#1577FF', background: '#EAF2FF'};
  }
  if (/update|install|download/.test(value)) {
    return {icon: IMAGES.update, tint: '#7445DF', background: '#F1ECFF'};
  }
  if (/logout/.test(value)) {
    return {icon: IMAGES.logout, tint: COLORS.ERROR, background: '#FDECEC'};
  }
  if (
    /error|failed|failure|unable|invalid|not available|no internet/.test(value)
  ) {
    return {icon: IMAGES.warning, tint: COLORS.ERROR, background: '#FDECEC'};
  }
  if (
    /warning|required|permission|limit|remove|delete|close|cancel|blocked/.test(
      value,
    )
  ) {
    return {icon: IMAGES.warning, tint: '#B7791F', background: '#FFF7E6'};
  }

  return {icon: IMAGES.infoFill, tint: '#7445DF', background: '#F1ECFF'};
};

const GlobalAlertProvider: FC<PropsWithChildren> = ({children}) => {
  const [currentAlert, setCurrentAlert] = useState<AlertRequest | null>(null);
  const currentAlertRef = useRef<AlertRequest | null>(null);
  const queueRef = useRef<AlertRequest[]>([]);

  const showNextAlert = useCallback(() => {
    const nextAlert = queueRef.current.shift() ?? null;
    currentAlertRef.current = nextAlert;
    setCurrentAlert(nextAlert);
  }, []);

  const closeAlert = useCallback(
    (notifyDismiss = false) => {
      const closingAlert = currentAlertRef.current;
      if (notifyDismiss) {
        closingAlert?.options?.onDismiss?.();
      }
      showNextAlert();
    },
    [showNextAlert],
  );

  const enqueueAlert = useCallback<AlertHandler>(
    (title = '', message = '', buttons, options) => {
      const request: AlertRequest = {
        title,
        message,
        buttons:
          Array.isArray(buttons) && buttons.length > 0
            ? buttons
            : [{text: 'OK'}],
        options,
      };

      if (currentAlertRef.current) {
        queueRef.current.push(request);
        return;
      }

      currentAlertRef.current = request;
      setCurrentAlert(request);
    },
    [],
  );

  useEffect(() => {
    bridge.handler = enqueueAlert;
    return () => {
      if (bridge.handler === enqueueAlert) {
        bridge.handler = null;
      }
    };
  }, [enqueueAlert]);

  const handleButtonPress = (button: AlertButton) => {
    closeAlert();
    button.onPress?.();
  };

  const handleRequestClose = () => {
    if (currentAlert?.options?.cancelable) {
      closeAlert(true);
    }
  };

  const visual = getAlertVisual(
    currentAlert?.title ?? '',
    currentAlert?.message ?? '',
  );
  const verticalButtons = (currentAlert?.buttons.length ?? 0) > 2;

  return (
    <>
      {children}
      <Modal
        transparent
        statusBarTranslucent
        visible={!!currentAlert}
        animationType="fade"
        onRequestClose={handleRequestClose}>
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (currentAlert?.options?.cancelable) {
                closeAlert(true);
              }
            }}
          />
          <View style={styles.card} accessibilityViewIsModal>
            <View
              style={[
                styles.iconContainer,
                {backgroundColor: visual.background},
              ]}>
              <Image
                source={visual.icon}
                resizeMode="contain"
                style={[styles.icon, {tintColor: visual.tint}]}
              />
            </View>

            <Text style={styles.title}>{currentAlert?.title || 'Alert'}</Text>
            {currentAlert?.message ? (
              <ScrollView
                style={styles.messageScroll}
                bounces={false}
                showsVerticalScrollIndicator={false}>
                <Text style={styles.message}>{currentAlert.message}</Text>
              </ScrollView>
            ) : null}

            <ScrollView
              style={verticalButtons ? styles.verticalButtonScroll : undefined}
              contentContainerStyle={[
                styles.buttons,
                verticalButtons && styles.verticalButtons,
              ]}
              bounces={false}
              showsVerticalScrollIndicator={false}>
              {currentAlert?.buttons.map((button, index) => {
                const isCancel = button.style === 'cancel';
                const isDestructive = button.style === 'destructive';
                const colors = isDestructive
                  ? ['#F45B62', '#D92D3A']
                  : ['#8858F9', '#6036C4'];

                return (
                  <TouchableOpacity
                    key={`${button.text || 'OK'}-${index}`}
                    activeOpacity={0.85}
                    onPress={() => handleButtonPress(button)}
                    style={[
                      styles.buttonTouchable,
                      verticalButtons && styles.verticalButtonTouchable,
                    ]}>
                    {isCancel ? (
                      <View style={[styles.button, styles.cancelButton]}>
                        <Text
                          style={[styles.buttonText, styles.cancelButtonText]}>
                          {button.text || 'Cancel'}
                        </Text>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={colors}
                        useAngle
                        angle={148.57}
                        style={styles.button}>
                        <Text style={styles.buttonText}>
                          {button.text || 'OK'}
                        </Text>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default GlobalAlertProvider;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZE.MS(22),
    backgroundColor: 'rgba(20, 24, 33, 0.55)',
  },
  card: {
    width: '100%',
    maxWidth: SIZE.MS(390),
    borderRadius: SIZE.MS(18),
    paddingHorizontal: SIZE.MS(18),
    paddingTop: SIZE.MS(22),
    paddingBottom: SIZE.MS(18),
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    shadowColor: COLORS.BLACK,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  iconContainer: {
    width: SIZE.MS(58),
    height: SIZE.MS(58),
    borderRadius: SIZE.MS(29),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZE.MS(13),
  },
  icon: {
    width: SIZE.MS(27),
    height: SIZE.MS(27),
  },
  title: {
    fontSize: SIZE.MS(18),
    lineHeight: SIZE.MS(23),
    fontFamily: FONTS.BOLD,
    color: '#263241',
    textAlign: 'center',
  },
  message: {
    fontSize: SIZE.MS(13),
    lineHeight: SIZE.MS(19),
    fontFamily: FONTS.REGULAR,
    color: '#667085',
    textAlign: 'center',
  },
  messageScroll: {
    width: '100%',
    maxHeight: SIZE.MS(220),
    marginTop: SIZE.MS(7),
    marginBottom: SIZE.MS(19),
  },
  buttons: {
    width: '100%',
    flexDirection: 'row',
    gap: SIZE.MS(10),
  },
  verticalButtonScroll: {
    width: '100%',
    maxHeight: SIZE.MS(260),
  },
  verticalButtons: {
    flexDirection: 'column',
  },
  buttonTouchable: {
    flex: 1,
  },
  verticalButtonTouchable: {
    flex: 0,
    width: '100%',
  },
  button: {
    minHeight: SIZE.MS(44),
    borderRadius: SIZE.MS(9),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZE.MS(12),
    paddingVertical: SIZE.MS(10),
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#E3E6EC',
    backgroundColor: '#F3F5F8',
  },
  buttonText: {
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.WHITE,
    textAlign: 'center',
  },
  cancelButtonText: {
    color: '#4A4F5D',
  },
});
