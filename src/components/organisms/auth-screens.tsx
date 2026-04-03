import {Loader} from '@molecules';
import {StatusBar} from 'expo-status-bar';
import React, {useRef} from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  View,
  ViewStyle,
  Dimensions,
} from 'react-native';
interface AuthScreenProps {
  children: React.ReactNode;
  fixedComponent?: React.ReactNode;
  fixedBottomComponent?: React.ReactNode;
  statusBarStyle?: 'light' | 'dark';
  translucent?: boolean;
  statusBgColor?: string;
  navBarColor?: string;
  loading?: boolean;
  bounces?: boolean;
  loaderMessage?: string;
}
const isIos = Platform.OS === 'ios';
const SCREEN_HEIGHT = Dimensions.get('window').height;
export function AuthScreen(props: AuthScreenProps) {
  const {
    children,
    fixedComponent,
    fixedBottomComponent,
    loading,
    bounces,
    statusBarStyle = 'light',
    translucent = true,
    statusBgColor = 'transparent',
    navBarColor,
    loaderMessage = 'Loading',
  } = props;
  const scrollViewRef = useRef<ScrollView>(null);
  return (
    <View style={$root}>
      {/* TOP SAFE AREA */}
      {isIos && (
        <View style={[$safeareaTop, {backgroundColor: statusBgColor}]} />
      )}
      {/* STATUS BAR
      <StatusBar
        style={statusBarStyle}
        translucent={translucent}
        backgroundColor={statusBgColor}
      /> */}
      {/* 🔥 CONTENT LAYER (NO RESIZE FEEL) */}
      <View style={$contentWrapper}>
        {fixedComponent}

        <ScrollView
          ref={scrollViewRef}
          bounces={bounces}
          style={$scrollView}
          contentContainerStyle={$scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>

        {loading && <Loader message={loaderMessage} />}
      </View>
      {/* 🔥 FIXED BOTTOM (STATIC) */}
      {fixedBottomComponent}
      {/* BOTTOM SAFE AREA */}
      {isIos && (
        <View
          style={[
            $safeareaBottom,
            {backgroundColor: navBarColor ?? 'transparent'},
          ]}
        />
      )}
    </View>
  );
}

/* ===================== STYLES ===================== */

const $root: ViewStyle = {
  flex: 1,
};

const $contentWrapper: ViewStyle = {
  flex: 1,
};

const $scrollView: ViewStyle = {
  flex: 1,
};

const $scrollContent: ViewStyle = {
  minHeight: SCREEN_HEIGHT, // 🔥 KEY LINE (visual stability)
  flexGrow: 1,
};

const $safeareaTop: ViewStyle = {
  backgroundColor: 'transparent',
};

const $safeareaBottom: ViewStyle = {
  backgroundColor: 'transparent',
};
