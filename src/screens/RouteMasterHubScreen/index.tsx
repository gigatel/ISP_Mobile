import React, {FC} from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@navigation/navigator';
import AllMasters from '@screens/allMasters';

type Props = NativeStackScreenProps<RootStackParamList, 'Route-Master-Hub'>;

const SharedAllMasters = AllMasters as FC<any>;

const RouteMasterHubScreen: FC<Props> = props => (
  <SharedAllMasters
    {...props}
    route={{
      ...props.route,
      params: {
        ...(props.route.params ?? {}),
        routeHubMode: true,
      },
    }}
  />
);

export default RouteMasterHubScreen;
