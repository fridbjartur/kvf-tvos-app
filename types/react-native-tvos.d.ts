import "react-native";

declare module "react-native" {
  interface TouchableOpacityProps {
    isTVSelectable?: boolean;
  }
}
