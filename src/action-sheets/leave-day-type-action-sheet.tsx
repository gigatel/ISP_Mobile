import {DropdownInput} from '@atoms';
import {OptionPickerSheet} from '@molecules';
import {DATA} from '@res';
import {DataType} from '@types';
import React, {memo, useState} from 'react';
const LeaveDayTypeActionSheet = ({
  value,
  setValue,
}: {
  value: DataType.IdName | null;
  setValue: (data: DataType.IdName) => void;
}) => {
  const [showPicker, setShowPicker] = useState(false);
  return (
    <>
      <DropdownInput
        title={'Leave Day Type'}
        disabled={false}
        value={value?.name ?? 'Select'}
        placeholder={'Select Leave Day Type'}
        onPress={() => setShowPicker(true)}
      />
      <OptionPickerSheet
        rowType={'default'}
        show={showPicker}
        value={value != null ? [value] : value}
        type={'single'}
        title={'Select Leave Day Type'}
        data={DATA?.LEAVE_DAY_TYPE ?? []}
        rowUniqueKey={'id'}
        enableSearch={false}
        // searchKeys={['name', 'id']}
        onClose={() => {
          setShowPicker(false);
        }}
        onDone={item => {
          setShowPicker(false);
          setValue(item?.[0]);
        }}
      />
    </>
  );
};

export default memo(LeaveDayTypeActionSheet);
