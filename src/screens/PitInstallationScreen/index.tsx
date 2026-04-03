import React, {FC} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {ScreenProps} from '@types';
import {Screen} from '@organisms';
import {BackHeader} from '@molecules';
import styles from './styles';
const PitInstallation: FC<ScreenProps.PitInstallationScreen> = ({
  navigation,
  route,
}) => {
  return (
    <Screen>
      <BackHeader
        headerTitle="Pit Installation Master"
        onBackPress={navigation.goBack}
      />
    </Screen>
  );
};
export default PitInstallation;
