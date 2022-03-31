import React, {useState} from 'react';
import {View, Text, Pressable} from 'react-native';

function Settings() {
  const [count, setCount] = useState(1);
  return (
    <View>
      <Pressable onPress={() => setCount(p => p + 1)}>
        <Text>{count}</Text>
      </Pressable>
    </View>
  );
}

export default Settings;
