import React, { useState, useCallback, useContext, useLayoutEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';

const startOfLocalDay = d => {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
};

export default function ShowtimeScreen({ route, navigation }) {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';
  const adminBounce = useRef(false);
  const p = route.params || {};
  const { movieTitle = 'Movie', movieId: paramMovieId, dayStartMs: paramDayStartMs, showtimeId } = p;

  useLayoutEffect(() => {
    if (isAdmin && !adminBounce.current) {
      adminBounce.current = true;
      navigation.goBack();
    }
  }, [isAdmin, navigation]);

  const [dayShowtimes, setDayShowtimes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDayShowtimes = useCallback(async () => {
    setLoading(true);
    try {
      let movieId = paramMovieId;
      let dayStartMs = paramDayStartMs;
      if ((movieId == null || dayStartMs == null) && showtimeId) {
        const stRes = await api.get(`/showtimes/${showtimeId}`);
        const st = stRes.data;
        movieId = st.movie?._id ?? st.movie;
        dayStartMs = startOfLocalDay(st.date);
      }
      if (movieId == null || dayStartMs == null) {
        Alert.alert('Error', 'Missing movie or date for showtimes.');
        setDayShowtimes([]);
        return;
      }
      const listRes = await api.get(`/showtimes/movie/${movieId}`);
      const list = Array.isArray(listRes.data) ? listRes.data : [];
      const dms = typeof dayStartMs === 'number' ? dayStartMs : startOfLocalDay(dayStartMs);
      const filtered = list
        .filter(s => startOfLocalDay(s.date) === dms)
        .sort((a, b) => String(a.time).localeCompare(String(b.time)));
      setDayShowtimes(filtered);
    } catch (err) {
      Alert.alert('Error', 'Could not load showtimes');
      setDayShowtimes([]);
    } finally {
      setLoading(false);
    }
  }, [paramMovieId, paramDayStartMs, showtimeId]);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) return;
      fetchDayShowtimes();
    }, [fetchDayShowtimes, isAdmin])
  );

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const openSeatBooking = async (st) => {
    if (st.availableSeats === 0) return;
    try {
      const takenRes = await api.get(`/bookings/showtime/${st._id}/taken`);
      const takenSeats = Array.isArray(takenRes.data?.takenSeats) ? takenRes.data.takenSeats : [];
      navigation.navigate('SeatBooking', {
        showtimeId: st._id,
        movieTitle,
        showtime: st,
        takenSeats,
      });
    } catch {
      Alert.alert('Error', 'Could not load seats for this showtime');
    }
  };

  if (isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  const headerDate = dayShowtimes[0]?.date;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBanner}>
        <View style={styles.bannerHeader}>
          <TouchableOpacity
            style={styles.backButton}
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.bannerTextWrap}>
            <Text style={styles.movieTitle}>{movieTitle}</Text>
            <Text style={styles.date}>
              {headerDate ? formatDate(headerDate) : 'Select a showtime'}
            </Text>
          </View>
        </View>
      </View>

      {dayShowtimes.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No showtimes for this day.</Text>
        </View>
      ) : (
        dayShowtimes.map(st => (
          <TouchableOpacity
            key={st._id}
            style={[styles.showRow, st.availableSeats === 0 && styles.showRowDisabled]}
            disabled={st.availableSeats === 0}
            onPress={() => void openSeatBooking(st)}
            activeOpacity={0.85}
          >
            <View style={styles.showRowLeft}>
              <Text style={styles.showTime}>{st.time}</Text>
              <Text style={styles.showSub}>Screen {st.screenNumber}</Text>
            </View>
            <View style={styles.showRowRight}>
              <Text style={[styles.seatsLeft, st.availableSeats === 0 && styles.soldOut]}>
                {st.availableSeats === 0 ? 'Sold out' : `${st.availableSeats} seats left`}
              </Text>
              {st.availableSeats > 0 ? (
                <Text style={styles.chevronHint}>Select seats</Text>
              ) : null}
            </View>
            {st.availableSeats > 0 ? (
              <Ionicons name="chevron-forward" size={20} color="#888" style={styles.rowChevron} />
            ) : null}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#0f0f0f' },
  content:             { paddingTop: 8, paddingBottom: 20, paddingHorizontal: 20 },
  centered:            { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' },
  topBanner: {
    backgroundColor: '#e50914',
    borderRadius: 28,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    marginBottom: 14,
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
  movieTitle:          { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 6 },
  date:                { fontSize: 14, color: '#ffd7db', marginBottom: 0 },
  emptyWrap:           { paddingVertical: 24, paddingHorizontal: 8 },
  emptyText:           { color: '#888', fontSize: 15, textAlign: 'center' },
  showRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  showRowDisabled:     { opacity: 0.65 },
  showRowLeft:         { flex: 1 },
  showTime:            { fontSize: 20, fontWeight: '700', color: '#e50914' },
  showSub:             { fontSize: 13, color: '#999', marginTop: 4 },
  showRowRight:        { alignItems: 'flex-end', marginRight: 4 },
  seatsLeft:           { fontSize: 13, color: '#aaa' },
  soldOut:             { color: '#666' },
  chevronHint:         { fontSize: 12, color: '#e50914', marginTop: 4, fontWeight: '600' },
  rowChevron:          { marginLeft: 4 },
});
