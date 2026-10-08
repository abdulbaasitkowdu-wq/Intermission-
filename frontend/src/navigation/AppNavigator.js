import React, { useContext } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthContext } from '../context/AuthContext';
import FloatingTabBar from './FloatingTabBar';

import LoginScreen      from '../screens/auth/LoginScreen';
import RegisterScreen   from '../screens/auth/RegisterScreen';
import MovieListScreen  from '../screens/movies/MovieListScreen';
import MovieDetailScreen from '../screens/movies/MovieDetailScreen';
import BrowseMoviesScreen from '../screens/movies/BrowseMoviesScreen';
import CreateMovieScreen from '../screens/movies/CreateMovieScreen';
import ShowtimeScreen   from '../screens/showtimes/ShowtimeScreen';
import AdminShowtimesScreen from '../screens/admin/AdminShowtimesScreen';
import AdminFeedbackScreen from '../screens/admin/AdminFeedbackScreen';
import AdminSuggestionsScreen from '../screens/admin/AdminSuggestionsScreen';
import ApprovedSuggestionsScreen from '../screens/admin/ApprovedSuggestionsScreen';
import BookingScreen    from '../screens/bookings/BookingScreen';
import MyBookingsScreen from '../screens/bookings/MyBookingsScreen';
import FeedbackScreen   from '../screens/feedback/FeedbackScreen';
import SuggestionScreen from '../screens/suggestions/SuggestionScreen';

const Stack  = createNativeStackNavigator();
const Tab    = createBottomTabNavigator();

// Bottom tabs shown after login (floating pill bar for users)
const MainTabs = () => (
  <Tab.Navigator
    tabBar={props => <FloatingTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Movies"      component={MovieListScreen} options={{ title: 'Home' }} />
    <Tab.Screen name="Bookings"    component={MyBookingsScreen} />
    <Tab.Screen name="Feedback"    component={FeedbackScreen} />
    <Tab.Screen name="Suggestions" component={SuggestionScreen} options={{ title: 'Profile' }} />
  </Tab.Navigator>
);

// Admin-only tabs
const AdminTabs = () => (
  <Tab.Navigator
    tabBar={props => <FloatingTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Movies" component={MovieListScreen} options={{ title: 'Home' }} />
    <Tab.Screen name="CreateMovieTab" component={CreateMovieScreen} options={{ title: 'Create Movie' }} />
    <Tab.Screen name="AdminShowtimes" component={AdminShowtimesScreen} options={{ title: 'Create Showtime' }} />
    <Tab.Screen name="AdminFeedback" component={AdminFeedbackScreen} options={{ title: 'Feedback' }} />
    <Tab.Screen name="AdminSuggestions" component={AdminSuggestionsScreen} options={{ title: 'Suggestions' }} />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f0f0f',
        }}
      >
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // Logged in screens
          <>
            <Stack.Screen
              name="Main"
              component={user.role === 'admin' ? AdminTabs : MainTabs}
            />
            <Stack.Screen name="MovieDetail" component={MovieDetailScreen} />
            <Stack.Screen name="BrowseMovies" component={BrowseMoviesScreen} />
            <Stack.Screen name="CreateMovie"     component={CreateMovieScreen} />
            <Stack.Screen name="Showtimes"       component={ShowtimeScreen} />
            <Stack.Screen name="SeatBooking"     component={BookingScreen} />
            <Stack.Screen name="AdminShowtimes"  component={AdminShowtimesScreen} />
            <Stack.Screen name="ApprovedSuggestions" component={ApprovedSuggestionsScreen} />
          </>
        ) : (
          // Auth screens
          <>
            <Stack.Screen name="Login"    component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;