import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api/axios';

const BG = '#0f0f0f';
const CARD = '#1c1c1c';
const BORDER = '#2a2a2a';
const ACCENT = '#e50914';
const MUTED = '#999';

function StarDisplay({ value }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <Text key={n} style={{ color: n <= value ? '#ffd60a' : '#444', fontSize: 18 }}>★</Text>
      ))}
    </View>
  );
}

export default function AdminFeedbackScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const tabBarHeight = useBottomTabBarHeight();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [movieFilter, setMovieFilter] = useState('all');
  const [replyFilter, setReplyFilter] = useState('all');
  const [movieQuery, setMovieQuery] = useState('');
  const [movieDropdownOpen, setMovieDropdownOpen] = useState(false);
  const [renderMovieDropdown, setRenderMovieDropdown] = useState(false);
  const dropdownAnim = React.useRef(new Animated.Value(0)).current;

  const openMovieDropdown = useCallback(() => {
    setRenderMovieDropdown(true);
    setMovieDropdownOpen(true);
    Animated.timing(dropdownAnim, {
      toValue: 1,
      duration: 170,
      useNativeDriver: true,
    }).start();
  }, [dropdownAnim]);

  const closeMovieDropdown = useCallback(() => {
    setMovieDropdownOpen(false);
    Animated.timing(dropdownAnim, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRenderMovieDropdown(false);
    });
  }, [dropdownAnim]);

  const loadFeedbacks = useCallback(async () => {
    if (user?.role !== 'admin') {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/feedback');
      setFeedbacks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not load feedback');
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadFeedbacks();
    }, [loadFeedbacks])
  );

  const openReplyModal = item => {
    if (item?.adminReply?.message?.trim()) return;
    setActiveFeedback(item);
    setReplyText('');
    setModalVisible(true);
  };

  const submitReply = async () => {
    if (!activeFeedback?._id) return;
    if (!replyText.trim()) {
      Alert.alert('Reply required', 'Please type a reply message.');
      return;
    }

    try {
      setSaving(true);
      await api.put(`/feedback/${activeFeedback._id}/reply`, { message: replyText.trim() });
      setModalVisible(false);
      setActiveFeedback(null);
      setReplyText('');
      await loadFeedbacks();
      Alert.alert('Saved', 'Reply has been posted.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save reply');
    } finally {
      setSaving(false);
    }
  };

  const movieOptions = useMemo(() => {
    const map = new Map();
    feedbacks.forEach(item => {
      const id = String(item.movie?._id || item.movie || '');
      const title = item.movie?.title || 'Movie';
      if (id && !map.has(id)) {
        map.set(id, { id, title });
      }
    });
    return [{ id: 'all', title: 'All movies' }, ...Array.from(map.values())];
  }, [feedbacks]);

  const filteredMovieOptions = useMemo(() => {
    const q = movieQuery.trim().toLowerCase();
    if (!q) return movieOptions;
    return movieOptions.filter(opt => opt.title.toLowerCase().includes(q));
  }, [movieOptions, movieQuery]);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter(item => {
      const movieMatch =
        movieFilter === 'all' ||
        String(item.movie?._id || item.movie || '') === movieFilter;

      const hasReply = Boolean(item.adminReply?.message?.trim());
      const replyMatch =
        replyFilter === 'all' ||
        (replyFilter === 'replied' && hasReply) ||
        (replyFilter === 'unreplied' && !hasReply);

      return movieMatch && replyMatch;
    });
  }, [feedbacks, movieFilter, replyFilter]);

  if (user?.role !== 'admin') {
    return (
      <View style={[styles.centered, { paddingBottom: tabBarHeight + 16 }]}>
        <Text style={styles.title}>Admin Feedback</Text>
        <Text style={styles.muted}>Only admins can access this screen.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centered, { paddingBottom: tabBarHeight + 16 }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={filteredFeedbacks}
        keyExtractor={item => item._id}
        contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 24 }}
        ListHeaderComponent={
          <>
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
                  <Text style={styles.title}>Feedback Inbox</Text>
                  <Text style={styles.bannerCaption}>Review user feedback and reply as admin.</Text>
                </View>
              </View>
            </View>
            <View style={styles.searchWrap}>
              <TextInput
                style={styles.searchInput}
                value={movieQuery}
                onChangeText={text => {
                  setMovieQuery(text);
                  if (!text.trim()) {
                    setMovieFilter('all');
                  }
                }}
                onFocus={openMovieDropdown}
                onBlur={() => {
                  // Delay close slightly so dropdown item presses still register.
                  setTimeout(closeMovieDropdown, 120);
                }}
                placeholder="Filter by movie..."
                placeholderTextColor="#666"
              />
              {renderMovieDropdown && (
                <Animated.View
                  style={[
                    styles.dropdown,
                    {
                      opacity: dropdownAnim,
                      transform: [
                        {
                          translateY: dropdownAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-6, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {filteredMovieOptions.length === 0 ? (
                    <Text style={styles.dropdownEmpty}>No movies found</Text>
                  ) : (
                    filteredMovieOptions.slice(0, 8).map(opt => (
                      <TouchableOpacity
                        key={`movie-opt-${opt.id}`}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setMovieFilter(opt.id);
                          setMovieQuery(opt.id === 'all' ? '' : opt.title);
                          closeMovieDropdown();
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{opt.title}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </Animated.View>
              )}
            </View>

            <View style={styles.replyFilterRow}>
              {[
                { id: 'all', label: 'All' },
                { id: 'replied', label: 'Replied' },
                { id: 'unreplied', label: 'Unreplied' },
              ].map(opt => {
                const active = replyFilter === opt.id;
                return (
                  <TouchableOpacity
                    key={`reply-${opt.id}`}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setReplyFilter(opt.id)}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        }
        ListEmptyComponent={<Text style={styles.muted}>No feedback for selected filters.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.movieTitle}>{item.movie?.title || 'Movie'}</Text>
            <Text style={styles.meta}>
              {item.user?.name || 'User'} ({item.user?.email || 'no email'})
            </Text>
            <StarDisplay value={item.rating || 0} />
            {!!item.comment && <Text style={styles.comment}>{item.comment}</Text>}

            {item.adminReply?.message && (
              <View style={styles.replyBox}>
                <Text style={styles.replyLabel}>Admin Reply</Text>
                <Text style={styles.replyText}>{item.adminReply.message}</Text>
              </View>
            )}

            <View style={styles.actionRight}>
              {item.adminReply?.message?.trim() ? (
                <Text style={styles.repliedPill}>Replied</Text>
              ) : (
                <TouchableOpacity style={styles.replyButton} onPress={() => openReplyModal(item)}>
                  <Text style={styles.replyButtonText}>Reply</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reply to Feedback</Text>
            <TextInput
              style={styles.input}
              multiline
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Type your reply..."
              placeholderTextColor="#666"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={submitReply} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Reply</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
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
  searchWrap: { marginBottom: 10 },
  searchInput: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 14,
  },
  dropdown: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: '#141414',
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  dropdownItemText: { color: '#fff', fontSize: 14 },
  dropdownEmpty: { color: MUTED, fontSize: 13, padding: 12 },
  replyFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  filterChipActive: { borderColor: ACCENT, backgroundColor: 'rgba(229,9,20,0.12)' },
  filterChipText: { color: MUTED, fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: ACCENT },
  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 10,
    paddingHorizontal: 11,
    marginBottom: 8,
    paddingRight: 124,
    position: 'relative',
  },
  movieTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  meta: { color: MUTED, fontSize: 12, marginTop: 2, marginBottom: 6 },
  starsRow: { flexDirection: 'row', gap: 2, marginBottom: 6 },
  comment: { color: '#ddd', fontSize: 13, lineHeight: 18 },
  actionRight: {
    position: 'absolute',
    right: 11,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  replyBox: {
    marginTop: 8,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 9,
  },
  replyLabel: { color: '#bbb', fontSize: 11, marginBottom: 3, fontWeight: '600' },
  replyText: { color: '#fff', fontSize: 13, lineHeight: 18 },
  replyButton: {
    marginTop: 0,
    alignSelf: 'flex-end',
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  replyButtonText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  repliedPill: {
    color: '#1D9E75',
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1D9E75',
    overflow: 'hidden',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  input: {
    minHeight: 120,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    color: '#fff',
    padding: 12,
    textAlignVertical: 'top',
  },
  modalActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelText: { color: MUTED, fontSize: 15 },
  saveButton: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
