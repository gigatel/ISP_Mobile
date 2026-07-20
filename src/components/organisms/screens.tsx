import {Loader} from '@molecules';
import {COLORS} from '@res';
import {StatusBar} from 'react-native';
import React, {useRef} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  View,
  ViewStyle,
} from 'react-native';
interface ScreenProps {
  isSafeArea?: boolean;
  isNavSafeArea?: boolean;
  children: React.ReactNode;
  fixedComponent?: React.ReactNode;
  fixedBottomComponent?: React.ReactNode;
  keyboardAvoidingEnabled?: boolean;
  statusBarStyle?: 'light' | 'dark';
  translucent?: boolean;
  statusBgColor?: string;
  navBarColor?: string;
  loading?: boolean;
  bounces?: boolean;
  preset: 'scroll' | 'fixed';
  loaderMessage?: string;
}
const isIos = Platform.OS === 'ios';
export function Screen(props: ScreenProps) {
  const {
    isSafeArea = true,
    isNavSafeArea = true,
    loading,
    bounces,
    children,
    statusBarStyle,
    translucent,
    statusBgColor,
    navBarColor,
    preset = 'fixed',
    fixedComponent,
    fixedBottomComponent,
    keyboardAvoidingEnabled = true,
    loaderMessage = 'Loading',
  } = props;
  const scrollViewRef = useRef<ScrollView>(null);
  return (
    <View style={$keyboardAvoidingViewStyle}>
      {isSafeArea && isIos && (
        <SafeAreaView
          style={[$safeareaTop, {backgroundColor: statusBgColor}]}
        />
      )}
      <StatusBar
        style={statusBarStyle ?? 'light'}
        translucent={translucent ?? false}
        backgroundColor={statusBgColor ?? COLORS.PRIMARY}
      />
      <KeyboardAvoidingView
        enabled={keyboardAvoidingEnabled}
        behavior={isIos ? 'padding' : 'height'}
        keyboardVerticalOffset={isIos ? 0 : 20}
        style={[$keyboardAvoidingViewStyle]}>
        {preset === 'fixed' ? (
          <>
            {children}
            {loading && <Loader message={loaderMessage} />}
          </>
        ) : (
          <>
            {fixedComponent}
            <ScrollView
              ref={scrollViewRef}
              bounces={bounces}
              style={$scrollViewStyle}
              contentContainerStyle={{flexGrow: 1}}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
            {fixedBottomComponent}
            {loading && <Loader message={loaderMessage} />}
          </>
        )}
      </KeyboardAvoidingView>
      {isNavSafeArea && isIos && (
        <SafeAreaView
          style={[$safeareaBottom, {backgroundColor: navBarColor}]}
        />
      )}
    </View>
  );
}
const $scrollViewStyle = {
  flex: 1,
};
const $safeareaTop: ViewStyle = {
  flex: 0,
  backgroundColor: COLORS.PRIMARY,
};
const $safeareaBottom: ViewStyle = {
  flex: 0,
  backgroundColor: COLORS.PRIMARY,
};
const $keyboardAvoidingViewStyle: ViewStyle = {
  flex: 1,
};
