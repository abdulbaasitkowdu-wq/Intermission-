import React, { useCallback, useContext, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api/axios';

const BG = '#0f0f0f';
const CARD = '#1c1c1c';
const BORDER = '#2a2a2a';
const ACCENT = '#e50914';
const MUTED = '#999';

const listHeader = (navigation, title, caption) => (
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
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.bannerCaption}>{caption}</Text>
      </View>
    </View>
  </View>
);

export default function ApprovedSuggestionsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    if (user?.role !== 'admin') {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/suggestions/status/approved');
      const raw = Array.isArray(res.data) ? res.data : [];
      setItems(
        [...raw].sort((a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0))
      );
    } catch (err) {
      setItems([]);
      Alert.alert('Error', err.response?.data?.message || 'Could not load approved suggestions');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (user?.role !== 'admin') {
    return (
      <View style={styles.root}>
        <FlatList
          data={[]}
          keyExtractor={(_, i) => `empty-${i}`}
          renderItem={() => null}
          ListHeaderComponent={listHeader(
            navigation,
            'Approved requests',
            'Only admins can view this list.'
          )}
          ListEmptyComponent={
            <View style={styles.deniedBlock}>
              <Text style={styles.muted}>Go back to continue.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.primaryBtnText}>Go back</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 32,
            flexGrow: 1,
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={loading ? [] : items}
        keyExtractor={item => item._id}
        ListHeaderComponent={listHeader(
          navigation,
          'Approved requests',
          'Titles approved for the lineup, sorted by vote count.'
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyLoading}>
              <ActivityIndicator size="large" color={ACCENT} />
            </View>
          ) : (
            <Text style={styles.muted}>No approved movie requests yet.</Text>
          )
        }
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 32,
          flexGrow: 1,
        }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.movieTitle} numberOfLines={3}>
                {item.movieTitle}
              </Text>
              {item.user?.name ? (
                <Text style={styles.by}>By {item.user.name}</Text>
              ) : null}
            </View>
            <View style={styles.votePill}>
              <Text style={styles.voteNum}>{item.votes ?? 0}</Text>
              <Text style={styles.voteLabel}>votes</Text>
            </View>
          </View>
        )}
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
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  bannerCaption: { color: '#ffd7db', fontSize: 14, marginTop: 6 },
  muted: { color: MUTED, fontSize: 14, marginTop: 6 },
  emptyLoading: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  deniedBlock: { paddingTop: 24, alignItems: 'center' },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: ACCENT,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  rowMain: { flex: 1, minWidth: 0, paddingRight: 6 },
  movieTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  by: { color: MUTED, fontSize: 13, marginTop: 6 },
  votePill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46,160,67,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 56,
  },
  voteNum: { color: '#3fb950', fontSize: 17, fontWeight: '800' },
  voteLabel: { color: '#7dcea0', fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
});
