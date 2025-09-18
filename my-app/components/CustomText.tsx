import { Text as DefaultText, TextProps } from 'react-native';
import { useFonts } from 'expo-font';

type CustomTextProps = TextProps & {
  style?: any;
  children: React.ReactNode;
};

export function CustomText({ style, children, ...props }: CustomTextProps) {
  const [fontsLoaded] = useFonts({
    'Prompt-Medium': require('../assets/fonts/Prompt-Medium.ttf'),
  });

  if (!fontsLoaded) {
    return <DefaultText style={style} {...props}>{children}</DefaultText>;
  }

  return (
    <DefaultText
      style={[
        { fontFamily: 'Prompt-Medium' },
        style,
      ]}
      {...props}
    >
      {children}
    </DefaultText>
  );
}
