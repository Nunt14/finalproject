import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';

type TextProps = RNTextProps & {
  children: React.ReactNode;
  style?: any;
};

const Text = ({ children, style, ...props }: TextProps) => {
  return (
    <RNText
      style={[styles.text, style]}
      {...props}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  text: {
    fontFamily: 'Prompt-Medium',
  },
});

export default Text;
