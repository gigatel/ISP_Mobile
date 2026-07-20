import React, {FC} from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@navigation/navigator';
import AllMasters from '@screens/allMasters';

type Props = NativeStackScreenProps<RootStackParamList, 'Select-Route-Master'>;

const SharedAllMasters = AllMasters as FC<any>;

const SelectRouteMasterScreen: FC<Props> = props => (
  <SharedAllMasters {...props} />
);

export default SelectRouteMasterScreen;
