import React, { useState, useCallback, useContext, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { isShowEnded } from '../../utils/showtimeTiming';
import { buildWatchedMovieRowsFromBookings } from '../../utils/watchedFromBookings';

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'archive', label: 'Archive' },
  { id: 'watched', label: 'Watched' },
];

const formatWhen = (showtime) => {
  if (!showtime?.date) return '';
  const d = new Date(showtime.date);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

export default function MyBookingsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const tabBarHeight = useBottomTabBarHeight();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('upcoming');

  const load = async () => {
    if (!user) {
      setBookings([]);
      return;
    }
    try {
      const res = await api.get('/bookings/my');
      setBookings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn(err.response?.data?.message || err.message);
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const upcoming = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.status !== 'confirmed') return false;
        const st = b.showtime;
        const m = st?.movie;
        const runtime = m?.duration ?? b.movieDuration;
        if (!st) return true;
        return !isShowEnded(st, runtime);
      }),
    [bookings]
  );

  const archive = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.status === 'cancelled') return true;
        if (b.status !== 'confirmed') return false;
        const st = b.showtime;
        const m = st?.movie;
        const runtime = m?.duration ?? b.movieDuration;
        if (!st) return false;
        return isShowEnded(st, runtime);
      }),
    [bookings]
  );

  const watchedRows = useMemo(() => buildWatchedMovieRowsFromBookings(bookings), [bookings]);

  const listData = tab === 'upcoming' ? upcoming : tab === 'archive' ? archive : watchedRows;

  const handleCancel = (item) => {
    if (item.status === 'cancelled') return;
    const st = item.showtime;
    const m = st?.movie;
    const runtime = m?.duration ?? item.movieDuration;
    if (st && isShowEnded(st, runtime)) {
      Alert.alert('Cannot cancel', 'This screening has already ended.');
      return;
    }
    Alert.alert('Cancel booking', 'Release these seats and cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.put(`/bookings/${item._id}`);
            await load();
            Alert.alert('Done', 'Your booking was cancelled.');
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not cancel');
          }
        },
      },
    ]);
  };

  if (loading && bookings.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  const emptyCopy =
    tab === 'upcoming'
      ? 'No upcoming bookings. Browse movies and book a showtime.'
      : tab === 'archive'
        ? 'No past or cancelled bookings yet.'
        : 'Movies you have watched will appear here after a confirmed screening ends.';

  return (
    <View style={styles.container}>
      <View style={styles.topBanner}>
        <View style={styles.bannerHeader}>
          <TouchableOpacity
            style={styles.backButton}
            accessibilityLabel="Go back"
            onPress={() => navigation.navigate('Movies')}
          >
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.bannerTextWrap}>
            <Text style={styles.title}>My bookings</Text>
            <Text style={styles.bannerCaption}>
              Upcoming tickets, past visits in Archive, and movies you have watched.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabChip, active && styles.tabChipActive]}
              onPress={() => setTab(t.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate('Movies')}>
        <Text style={styles.browseBtnText}>Browse movies</Text>
      </TouchableOpacity>

      {tab === 'watched' ? (
        <FlatList
          data={listData}
          keyExtractor={(item) => String(item.movie?._id ?? item.lastEndedAt)}
          contentContainerStyle={[styles.list, { paddingBottom: 24 + tabBarHeight }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e50914" />
          }
          ListEmptyComponent={<Text style={styles.empty}>{emptyCopy}</Text>}
          renderItem={({ item }) => (
            <View style={styles.watchedCard}>
              {item.movie.posterUrl ? (
                <Image source={{ uri: item.movie.posterUrl }} style={styles.watchedPoster} />
              ) : (
                <View style={[styles.watchedPoster, styles.watchedPosterPh]}>
                  <Text style={styles.watchedEmoji}>🎬</Text>
                </View>
              )}
              <View style={styles.watchedBody}>
                <Text style={styles.movieName} numberOfLines={2}>
                  {item.movie.title}
                </Text>
                <Text style={styles.line}>Screening ended {item.lastEndedLabel || '—'}</Text>
                <TouchableOpacity
                  style={styles.feedbackLink}
                  onPress={() => navigation.navigate('Feedback')}
                >
                  <Text style={styles.feedbackLinkText}>Leave feedback →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[styles.list, { paddingBottom: 24 + tabBarHeight }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e50914" />
          }
          ListEmptyComponent={<Text style={styles.empty}>{emptyCopy}</Text>}
          renderItem={({ item }) => {
            const m = item.showtime?.movie;
            const st = item.showtime;
            const isCancelled = item.status === 'cancelled';
            const runtime = m?.duration ?? item.movieDuration;
            const ended = st && isShowEnded(st, runtime);
            return (
              <View style={[styles.card, isCancelled && styles.cardCanceled]}>
                <Text style={styles.movieName} numberOfLines={1}>
                  {m?.title || item.movieTitle || 'Movie'}
                </Text>
                {st && (
                  <Text style={styles.line}>
                    {formatWhen(st)} · {st.time} · Screen {st.screenNumber}
                  </Text>
                )}
                <Text style={styles.seats}>
                  Seats: {item.seats?.join(', ')} · ${item.totalPrice ?? '—'}
                </Text>
                <Text style={[styles.status, isCancelled && styles.statusOff, ended && !isCancelled && styles.statusArchive]}>
                  {isCancelled ? 'Cancelled' : ended ? 'Past visit' : 'Confirmed'}
                </Text>
                {!isCancelled && !ended && (
                  <TouchableOpacity onPress={() => handleCancel(item)} style={styles.cancelBtn}>
                    <Text style={styles.cancelText}>Cancel booking</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', paddingTop: 8, paddingHorizontal: 16 },
  topBanner: {
    backgroundColor: '#e50914',
    borderRadius: 28,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    marginBottom: 12,
    marginHorizontal: -24,
    borderWidth: 1,
    borderColor: '#c80712',
  },
  bannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerTextWrap: { flex: 1 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#aa1d27',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },
  bannerCaption: { color: '#ffd7db', fontSize: 14, marginTop: 6, lineHeight: 20 },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  tabChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  tabChipActive: {
    borderColor: '#e50914',
    backgroundColor: 'rgba(229,9,20,0.15)',
  },
  tabChipText: { color: '#999', fontSize: 13, fontWeight: '600' },
  tabChipTextActive: { color: '#fff' },
  browseBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#e50914',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  browseBtnText: { color: '#e50914', fontWeight: '600' },
  list: { paddingBottom: 8 },
  empty: { color: '#666', fontSize: 14, textAlign: 'center', marginTop: 32, lineHeight: 22, paddingHorizontal: 12 },
  card: {
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardCanceled: { opacity: 0.75 },
  movieName: { color: '#fff', fontSize: 18, fontWeight: '600' },
  line: { color: '#999', fontSize: 14, marginTop: 6 },
  seats: { color: '#ccc', fontSize: 14, marginTop: 4 },
  status: { color: '#1D9E75', fontSize: 12, marginTop: 8, fontWeight: '600' },
  statusOff: { color: '#999' },
  statusArchive: { color: '#c9a227' },
  cancelBtn: { marginTop: 10, alignSelf: 'flex-start' },
  cancelText: { color: '#c44', fontSize: 14, fontWeight: '600' },
  watchedCard: {
    flexDirection: 'row',
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 12,
  },
  watchedPoster: { width: 72, height: 104, borderRadius: 10, backgroundColor: '#2a2a2a' },
  watchedPosterPh: { alignItems: 'center', justifyContent: 'center' },
  watchedEmoji: { fontSize: 28 },
  watchedBody: { flex: 1, minWidth: 0, justifyContent: 'center' },
  feedbackLink: { marginTop: 10, alignSelf: 'flex-start' },
  feedbackLinkText: { color: '#e50914', fontSize: 14, fontWeight: '600' },
});
