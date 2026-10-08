import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/axios';

const BG = '#0f0f0f';
const CARD = '#1c1c1c';
const BORDER = '#2a2a2a';
const ACCENT = '#e50914';
const MUTED = '#999';

function applyCategoryAndSearch(movies, category, search) {
  let result = movies;
  if (category && category !== 'All') {
    result = result.filter(movie =>
      (movie.genre || '').toLowerCase().includes(String(category).toLowerCase())
    );
  }
  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase();
    result = result.filter(movie => (movie.title || '').toLowerCase().includes(q));
  }
  return result;
}

export default function BrowseMoviesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const status = route.params?.status;
  const category = route.params?.category ?? 'All';
  const search = route.params?.search ?? '';

  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  const title = useMemo(
    () =>
      status === 'Now Showing'
        ? 'Now in cinemas'
        : status === 'Coming Soon'
          ? 'Coming soon'
          : 'Movies',
    [status]
  );

  const bannerCaption = useMemo(() => {
    const bits = [];
    if (status === 'Now Showing') {
      bits.push('All titles currently marked Now Showing.');
    } else if (status === 'Coming Soon') {
      bits.push('Upcoming releases marked Coming Soon.');
    } else {
      bits.push('Browse the catalog.');
    }
    if (category && category !== 'All') {
      bits.push(`Category: ${category}.`);
    }
    if (String(search).trim()) {
      bits.push(`Search: “${String(search).trim()}”.`);
    }
    return bits.join(' ');
  }, [status, category, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/movies');
      setMovies(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const filtered = applyCategoryAndSearch(movies, category, search);
    if (!status) return filtered;
    return filtered.filter(m => m.status === status);
  }, [movies, category, search, status]);

  const listHeader = (
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
          <Text style={styles.bannerTitle}>{title}</Text>
          <Text style={styles.bannerCaption}>{bannerCaption}</Text>
        </View>
      </View>
    </View>
  );

  const renderRow = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('MovieDetail', { movieId: item._id })}
    >
      {item.posterUrl ? (
        <Image source={{ uri: item.posterUrl }} style={styles.poster} />
      ) : (
        <View style={styles.posterFallback}>
          <Text style={styles.posterEmoji}>🎬</Text>
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {item.genre} · {item.duration} min
        </Text>
        <Text style={styles.rowStatus}>{item.status}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={MUTED} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={loading ? [] : rows}
        keyExtractor={item => item._id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyLoading}>
              <ActivityIndicator size="large" color={ACCENT} />
            </View>
          ) : (
            <Text style={styles.muted}>No movies match these filters.</Text>
          )
        }
        renderItem={renderRow}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 32,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
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
  bannerTextWrap: { flex: 1, minWidth: 0 },
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
  bannerTitle: { color: '#fff', fontSize: 24, fontWeight: '700' },
  bannerCaption: { color: '#ffd7db', fontSize: 14, marginTop: 6, lineHeight: 20 },
  muted: { color: MUTED, fontSize: 14, marginTop: 6 },
  emptyLoading: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  poster: { width: 56, height: 84, borderRadius: 8, backgroundColor: '#111' },
  posterFallback: {
    width: 56,
    height: 84,
    borderRadius: 8,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterEmoji: { fontSize: 28 },
  rowText: { flex: 1, minWidth: 0, paddingRight: 6 },
  rowTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  rowMeta: { color: MUTED, fontSize: 13, marginTop: 6 },
  rowStatus: { color: ACCENT, fontSize: 12, fontWeight: '700', marginTop: 6 },
});
