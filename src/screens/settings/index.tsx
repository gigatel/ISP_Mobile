import {Screen} from '@organisms';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {ScreenProps} from '@types';
import React, {FC, useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  View,
  Pressable,
} from 'react-native';
import {
  Padding,
  Gap,
  Border,
  FontSize,
  LineHeight,
  FontFamily,
} from '../../res/globalStyle';
import {useTranslation} from 'react-i18next';
import {Common, Preferences, Voice} from '@utils';
import i18next from '../../locales/i18n';
import Tts from 'react-native-tts';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@navigation/navigator';
type NavigationProps = NativeStackNavigationProp<
  RootStackParamList,
  'ProfileScreen'
>;
const Settings: FC<ScreenProps.Settings> = () => {
  const {t} = useTranslation();
  const navigation = useNavigation<NavigationProps>();
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    i18next.language || 'en',
  );
  useEffect(() => {
    (async () => {
      try {
        const savedLanguage = await Preferences.getData('LANGUAGE');
        if (savedLanguage && savedLanguage !== i18next.language) {
          await i18next.changeLanguage(savedLanguage);
          setSelectedLanguage(savedLanguage);
        }
        // Init TTS safely
        try {
          await Tts.getInitStatus();
        } catch (e) {
          console.log('TTS init error', e);
        }
      } catch (e) {
        Common.error(e);
      }
    })();
  }, []);
  const changeLanguage = async (lang: string) => {
    try {
      await Preferences.setData('LANGUAGE', lang);
      if (lang !== i18next.language) {
        await i18next.changeLanguage(lang);
      }
      setSelectedLanguage(lang);
    } catch (e) {
      Common.error(e);
    }
  };
  const handleSpeak = () => {
    setSelectedLanguage('speak'); // ✅ SELECT SPEAK
    Voice.speak('GTPL मोबाइल ऐप में आपका स्वागत है');
  };
  const LanguageCard = ({
    lang,
    label,
    icon,
    onPress,
  }: {
    lang: string;
    label: string;
    icon: any;
    onPress: () => void;
  }) => {
    const isSelected = selectedLanguage === lang;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={[styles.card, isSelected && styles.selectedCard]}>
        <Image source={icon} style={styles.flag} />
        <Text style={styles.label}>{label}</Text>

        {isSelected && (
          <View style={styles.checkWrapper}>
            <Image source={IMAGES.checkLanguage} style={styles.checkIcon} />
          </View>
        )}
      </TouchableOpacity>
    );
  };
  return (
    <Screen
      preset="fixed"
      statusBarStyle="dark"
      statusBgColor={COLORS.BACKGROUND_DEFAULT}>
      <View style={styles.view}>
        <View style={[styles.header, styles.mainFlexBox]}>
          <Pressable onPress={() => navigation.goBack()}>
            <Image
              source={IMAGES.arrowBack}
              style={styles.arrowBack24dp434343Fill0WIcon}
              resizeMode="cover"
            />
          </Pressable>

          <View style={styles.lanheader}>
            <Text style={styles.chooseTheLanguage}>Choose the language</Text>
            <Text style={styles.selectYourPreferred}>
              Select your preferred language below This helps us serve you
              better.
            </Text>
          </View>
        </View>
        <View style={styles.row}>
          <LanguageCard
            lang="en"
            label={t('settings.english') || 'English'}
            icon={IMAGES.usiconFlag}
            onPress={() => changeLanguage('en')}
          />
          <LanguageCard
            lang="hi"
            label={t('settings.hindi') || 'हिन्दी'}
            icon={IMAGES.indianFlag}
            onPress={() => changeLanguage('hi')}
          />
          <LanguageCard
            lang="speak"
            label="Speak"
            icon={IMAGES.speakerIcon}
            onPress={handleSpeak}
          />
        </View>
      </View>
    </Screen>
  );
};

export default Settings;
const styles = StyleSheet.create({
  view: {
    flex: 1,
    padding: SIZE.MS(16),
    backgroundColor: COLORS.colorWhite,
  },
  header: {
    gap: Gap.gap_12,
    marginBottom: SIZE.MVS(24),
  },
  chooseTheLanguage: {
    fontSize: SIZE.MS(18),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  selectYourPreferred: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  row: {
    flexDirection: 'row',
    gap: SIZE.MVS(16),
  },
  lanheader: {
    gap: Gap.gap_12,
    alignSelf: 'stretch',
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_12,
    padding: Padding.padding_12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 3,
  },
  mainFlexBox: {
    gap: Gap.gap_24,
    alignSelf: 'stretch',
  },
  selectedCard: {
    borderColor: COLORS.PRIMARY,
  },
  flag: {
    width: '100%',
    height: SIZE.MS(46),
    borderRadius: Border.br_8,
  },
  arrowBack24dp434343Fill0WIcon: {
    width: SIZE.MS(24),
    height: SIZE.MS(24),
  },
  label: {
    marginTop: SIZE.MVS(8),
    fontSize: FontSize.fs_14,
    lineHeight: LineHeight.lh_15,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    textAlign: 'center',
  },
  checkWrapper: {
    position: 'absolute',
    top: -10,
    right: -10,
    height: SIZE.MS(28),
    width: SIZE.MS(28),
    borderRadius: SIZE.MS(14),
    backgroundColor: COLORS.PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    width: SIZE.MS(14),
    height: SIZE.MS(14),
    tintColor: COLORS.colorWhite,
  },
});
