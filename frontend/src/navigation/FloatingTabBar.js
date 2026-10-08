import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Match app theme (see LoginScreen, MovieListScreen: #0f0f0f bg, #e50914 accent, #1c1c1c cards)
const ACCENT = '#e50914';
const INACTIVE = '#999';

const TAB_CONFIG = {
  Movies: {
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
    label: 'Home',
  },
  Bookings: {
    activeIcon: 'videocam',
    inactiveIcon: 'videocam-outline',
    label: 'Bookings',
  },
  Feedback: {
    activeIcon: 'bookmark',
    inactiveIcon: 'bookmark-outline',
    label: 'Feedback',
  },
  Suggestions: {
    activeIcon: 'person',
    inactiveIcon: 'person-outline',
    label: 'Requests',
  },
  CreateMovieTab: {
    activeIcon: 'add-circle',
    inactiveIcon: 'add-circle-outline',
    label: 'Add Movie',
  },
  AdminShowtimes: {
    activeIcon: 'calendar',
    inactiveIcon: 'calendar-outline',
    label: 'Showtimes',
  },
  AdminFeedback: {
    activeIcon: 'chatbubble',
    inactiveIcon: 'chatbubble-outline',
    label: 'Feedback',
  },
  AdminSuggestions: {
    activeIcon: 'bulb',
    inactiveIcon: 'bulb-outline',
    label: 'Suggestions',
  },
};

export default function FloatingTabBar({ state, descriptors, navigation, insets }) {
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const bottom = Math.max(insets.bottom, 8);

  return (
    <View
      onLayout={e => {
        const h = e.nativeEvent.layout.height;
        onHeightChange?.(h);
      }}
      style={[
        styles.wrapper,
        { paddingBottom: bottom + 6, paddingTop: 8, paddingHorizontal: 12 },
      ]}
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const config = TAB_CONFIG[route.name] || {
            activeIcon: 'ellipse',
            inactiveIcon: 'ellipse-outline',
            label: route.name,
          };

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={
                options.tabBarAccessibilityLabel || config.label
              }
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isFocused ? config.activeIcon : config.inactiveIcon}
                size={28}
                color={isFocused ? ACCENT : INACTIVE}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  { color: isFocused ? ACCENT : INACTIVE },
                ]}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: 88,
    paddingVertical: 18,
    paddingHorizontal: 10,
    borderRadius: 48,
    backgroundColor: 'rgba(28, 28, 28, 0.97)',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    minWidth: 0,
  },
  tabLabel: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
    textAlign: 'center',
    maxWidth: '100%',
  },
});
