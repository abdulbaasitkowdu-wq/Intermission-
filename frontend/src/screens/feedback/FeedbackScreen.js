import React, { useState, useCallback, useContext, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { buildWatchedMovieRowsFromBookings } from '../../utils/watchedFromBookings';

const BG = '#0f0f0f';
const CARD = '#1c1c1c';
const BORDER = '#2a2a2a';
const ACCENT = '#e50914';
const MUTED = '#888';

function Stars({ value, onChange, size = 32 }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity
          key={n}
          onPress={() => onChange(n)}
          hitSlop={8}
          accessibilityLabel={`${n} stars`}
        >
          <Text style={{ fontSize: size, color: n <= value ? '#ffd60a' : '#444' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ratingLabel(n) {
  const map = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Great', 5: 'Excellent' };
  return map[n] || '';
}

function StarDisplay({ value, size = 20 }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <Text key={n} style={{ fontSize: size, color: n <= value ? '#ffd60a' : '#444' }}>★</Text>
      ))}
    </View>
  );
}

function AdminReplyMetaLine({ adminReply }) {
  const name = adminReply?.repliedBy?.name?.trim();
  const when = adminReply?.repliedAt
    ? new Date(adminReply.repliedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';
  const meta = [name, when].filter(Boolean).join(' · ');
  if (!meta) return null;
  return <Text style={styles.adminReplyMeta}>{meta}</Text>;
}

export default function FeedbackScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const tabBarHeight = useBottomTabBarHeight();

  const [myBookings, setMyBookings] = useState([]);
  const [myFeedback, setMyFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [movieModal, setMovieModal] = useState(false);
  const [filterModal, setFilterModal] = useState(false);
  const [reviewFilterMovieId, setReviewFilterMovieId] = useState('all');

  const [pickMovie, setPickMovie] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [pendingDeleteReview, setPendingDeleteReview] = useState(null);
  const [deletingReview, setDeletingReview] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const reviewFilterOptions = useMemo(() => {
    const map = new Map();
    myFeedback.forEach(f => {
      const id = String(f.movie?._id || f.movie || '');
      const title = f.movie?.title || 'Movie';
      if (id && !map.has(id)) {
        map.set(id, { id, title });
      }
    });
    return [{ id: 'all', title: 'All reviews' }, ...Array.from(map.values())];
  }, [myFeedback]);

  const selectedFilterLabel = useMemo(() => {
    const opt = reviewFilterOptions.find((o) => o.id === reviewFilterMovieId);
    return opt?.title ?? 'All reviews';
  }, [reviewFilterOptions, reviewFilterMovieId]);

  const filteredMyFeedback = useMemo(() => {
    if (reviewFilterMovieId === 'all') return myFeedback;
    return myFeedback.filter(
      f => String(f.movie?._id || f.movie || '') === reviewFilterMovieId
    );
  }, [myFeedback, reviewFilterMovieId]);

  const watchedRows = useMemo(
    () => buildWatchedMovieRowsFromBookings(myBookings),
    [myBookings]
  );

  const watchedMovies = useMemo(
    () => watchedRows.map((r) => r.movie).filter(Boolean),
    [watchedRows]
  );

  const toRate = useMemo(() => {
    const reviewed = new Set(myFeedback.map((f) => String(f.movie?._id || f.movie || '')));
    return watchedMovies.filter((m) => !reviewed.has(String(m._id)));
  }, [watchedMovies, myFeedback]);

  const load = useCallback(async () => {
    try {
      const [bRes, fRes] = await Promise.allSettled([
        user ? api.get('/bookings/my') : Promise.resolve({ data: [] }),
        user ? api.get('/feedback/my') : Promise.resolve({ data: [] }),
      ]);
      if (bRes.status === 'fulfilled' && Array.isArray(bRes.value.data)) {
        setMyBookings(bRes.value.data);
      } else {
        setMyBookings([]);
      }
      if (fRes.status === 'fulfilled' && Array.isArray(fRes.value.data)) {
        setMyFeedback(fRes.value.data);
      } else {
        setMyFeedback([]);
      }
    } catch {
      setMyBookings([]);
      setMyFeedback([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      load();
    }, [user, load])
  );

  const submit = async () => {
    if (!user) {
      Alert.alert('Sign in', 'Log in to post feedback.');
      return;
    }
    if (!pickMovie) {
      Alert.alert('Movie', 'Choose a movie to review.');
      return;
    }
    if (rating < 1 || rating > 5) {
      Alert.alert('Rating', 'Tap a star rating from 1 to 5.');
      return;
    }
    try {
      setSaving(true);
      await api.post('/feedback', {
        movieId: pickMovie._id,
        rating,
        comment: comment.trim() || undefined,
      });
      setPickMovie(null);
      setRating(0);
      setComment('');
      await load();
      Alert.alert('Thanks', 'Your review was posted.');
    } catch (err) {
      Alert.alert('Could not post', err.response?.data?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const closeDeleteReviewModal = () => {
    if (!deletingReview) setPendingDeleteReview(null);
  };

  const executeDeleteReview = async () => {
    if (!pendingDeleteReview?._id) return;
    try {
      setDeletingReview(true);
      await api.delete(`/feedback/${pendingDeleteReview._id}`);
      setPendingDeleteReview(null);
      await load();
      Alert.alert('Removed', 'Your review was deleted.');
    } catch (err) {
      Alert.alert('Could not delete', err.response?.data?.message || 'Try again');
    } finally {
      setDeletingReview(false);
    }
  };

  const openEditModal = f => {
    setEditTarget(f);
    setEditRating(Math.min(5, Math.max(1, Number(f.rating) || 1)));
    setEditComment(typeof f.comment === 'string' ? f.comment : '');
    setEditModal(true);
  };

  const closeEditModal = () => {
    setEditModal(false);
    setEditTarget(null);
    setEditRating(0);
    setEditComment('');
  };

  const submitEdit = async () => {
    if (!editTarget?._id) return;
    if (editRating < 1 || editRating > 5) {
      Alert.alert('Rating', 'Choose a star rating from 1 to 5.');
      return;
    }
    try {
      setSavingEdit(true);
      await api.put(`/feedback/${editTarget._id}`, {
        rating: editRating,
        comment: editComment.trim(),
      });
      await load();
      closeEditModal();
      Alert.alert('Updated', 'Your review was saved.');
    } catch (err) {
      Alert.alert('Could not save', err.response?.data?.message || 'Try again');
    } finally {
      setSavingEdit(false);
    }
  };

  const padBottom = tabBarHeight + 16;
  const padTop = 8;

  if (!user) {
    return (
      <View style={[styles.emptyRoot, { paddingTop: padTop, paddingBottom: padBottom }]}>
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
              <Text style={styles.h1}>Feedback</Text>
              <Text style={styles.bannerCaption}>Log in to rate movies you have watched (after a screening ends).</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: padTop, paddingBottom: padBottom, paddingHorizontal: 20 }}
      keyboardShouldPersistTaps="handled"
    >
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
            <Text style={styles.h1}>Feedback</Text>
            <Text style={styles.bannerCaption}>
              You can only review movies from confirmed bookings after the screening has ended.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Movie</Text>
        <TouchableOpacity
          style={styles.select}
          onPress={() => setMovieModal(true)}
          activeOpacity={0.85}
        >
          <Text style={pickMovie ? styles.selectValue : styles.selectPh}>
            {pickMovie ? pickMovie.title : 'Select a movie…'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Your rating</Text>
        <Stars value={rating} onChange={setRating} />
        {rating > 0 && <Text style={styles.ratingHint}>{rating} — {ratingLabel(rating)}</Text>}

        <Text style={styles.label}>Comment (optional)</Text>
        <TextInput
          style={styles.textArea}
          placeholder="What did you think?"
          placeholderTextColor="#666"
          value={comment}
          onChangeText={setComment}
          multiline
        />

        <TouchableOpacity
          style={[styles.primaryBtn, saving && styles.btnDisabled]}
          onPress={submit}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnT}>Post review</Text>}
        </TouchableOpacity>

        {toRate.length === 0 && watchedMovies.length > 0 && (
          <Text style={styles.hint}>You have rated every movie you have watched. Thanks!</Text>
        )}
        {watchedMovies.length === 0 && (
          <Text style={styles.hint}>
            No eligible movies yet. Book a ticket, attend the show, then post feedback here or from Bookings → Watched.
          </Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Your reviews</Text>
      {myFeedback.length === 0 ? (
        <Text style={styles.mutedP}>You haven’t posted a review yet.</Text>
      ) : (
        <>
          <Text style={styles.filterLabel}>Filter by movie</Text>
          <TouchableOpacity
            style={styles.filterSelect}
            onPress={() => setFilterModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.filterSelectText} numberOfLines={1}>
              {selectedFilterLabel}
            </Text>
            <Text style={styles.filterSelectChevron}>▾</Text>
          </TouchableOpacity>

          {filteredMyFeedback.length === 0 ? (
            <Text style={styles.mutedP}>No reviews for the selected movie.</Text>
          ) : (
            filteredMyFeedback.map(f => {
          const title = f.movie?.title || 'Movie';
          return (
            <View key={f._id} style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                {f.movie?.posterUrl ? (
                  <Image source={{ uri: f.movie.posterUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPh]}>
                    <Text style={styles.thumbEm}>🎬</Text>
                  </View>
                )}
                <View style={styles.reviewBody}>
                  <View style={styles.reviewTitleRow}>
                    <Text style={styles.reviewTitle} numberOfLines={2}>
                      {title}
                    </Text>
                    <View style={styles.reviewActions}>
                      <TouchableOpacity
                        style={styles.iconReviewBtn}
                        onPress={() => openEditModal(f)}
                        disabled={pendingDeleteReview != null || deletingReview || savingEdit}
                        accessibilityLabel="Edit review"
                      >
                        <Ionicons name="pencil-outline" size={20} color={ACCENT} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconReviewBtn}
                        onPress={() => setPendingDeleteReview(f)}
                        disabled={pendingDeleteReview != null || deletingReview || savingEdit}
                        accessibilityLabel="Delete review"
                      >
                        <Ionicons name="trash-outline" size={20} color="#c44" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <StarDisplay value={f.rating} size={20} />
                  {f.comment ? <Text style={styles.reviewComment}>{f.comment}</Text> : null}
                </View>
              </View>
              {f.adminReply?.message?.trim() ? (
                <View style={styles.adminReplyBox}>
                  <Text style={styles.adminReplyLabel}>Staff reply</Text>
                  <Text style={styles.adminReplyText}>{f.adminReply.message.trim()}</Text>
                  <AdminReplyMetaLine adminReply={f.adminReply} />
                </View>
              ) : null}
            </View>
          );
            })
          )}
        </>
      )}

      <Modal
        visible={pendingDeleteReview != null}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteReviewModal}
      >
        <View style={styles.deleteReviewModalWrap}>
          <Pressable style={styles.deleteReviewModalBackdrop} onPress={closeDeleteReviewModal} />
          <View style={styles.deleteReviewModalCard}>
            <Text style={styles.deleteReviewModalTitle}>Are you sure you want to delete?</Text>
            <Text style={styles.deleteReviewModalBody}>
              {pendingDeleteReview
                ? `This will remove your review for “${pendingDeleteReview.movie?.title || 'this movie'}”. You cannot undo this.`
                : ''}
            </Text>
            <View style={styles.deleteReviewModalActions}>
              <TouchableOpacity
                style={[styles.deleteReviewModalBtn, styles.deleteReviewModalBtnGhost]}
                onPress={closeDeleteReviewModal}
                disabled={deletingReview}
              >
                <Text style={styles.deleteReviewModalBtnGhostT}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteReviewModalBtn, styles.deleteReviewModalBtnDanger]}
                onPress={() => void executeDeleteReview()}
                disabled={deletingReview}
              >
                {deletingReview ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteReviewModalBtnDangerT}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editModal} animationType="fade" transparent onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalH}>Edit review</Text>
            {editTarget ? (
              <Text style={styles.editMovieTitle} numberOfLines={2}>
                {editTarget.movie?.title || 'Movie'}
              </Text>
            ) : null}
            <Text style={styles.label}>Your rating</Text>
            <Stars value={editRating} onChange={setEditRating} size={28} />
            {editRating > 0 ? (
              <Text style={styles.ratingHint}>
                {editRating} — {ratingLabel(editRating)}
              </Text>
            ) : null}
            <Text style={styles.label}>Comment (optional)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="What did you think?"
              placeholderTextColor="#666"
              value={editComment}
              onChangeText={setEditComment}
              multiline
            />
            <View style={styles.editModalActions}>
              <TouchableOpacity onPress={closeEditModal} disabled={savingEdit}>
                <Text style={styles.link}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editSaveBtn, savingEdit && styles.btnDisabled]}
                onPress={() => void submitEdit()}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.editSaveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={filterModal} animationType="fade" transparent onRequestClose={() => setFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalH}>Filter reviews</Text>
            <FlatList
              data={reviewFilterOptions}
              keyExtractor={(opt) => String(opt.id)}
              style={styles.modalList}
              renderItem={({ item: opt }) => (
                <TouchableOpacity
                  style={[
                    styles.modalRow,
                    styles.filterPickerRow,
                    reviewFilterMovieId === opt.id && styles.modalRowSelected,
                  ]}
                  onPress={() => {
                    setReviewFilterMovieId(opt.id);
                    setFilterModal(false);
                  }}
                >
                  <Text style={styles.modalRowT} numberOfLines={2}>
                    {opt.title}
                  </Text>
                  {reviewFilterMovieId === opt.id ? <Text style={styles.modalRowCheck}>✓</Text> : null}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setFilterModal(false)} style={styles.modalClose}>
              <Text style={styles.link}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={movieModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalH}>Choose a movie</Text>
            {toRate.length === 0 ? (
              <Text style={styles.mutedP}>
                {watchedMovies.length
                  ? 'You have already reviewed every movie you have watched.'
                  : 'Attend a screening first; only watched movies can be reviewed.'}
              </Text>
            ) : (
              <FlatList
                data={toRate}
                keyExtractor={(m, i) => String(m?._id ?? `movie-${i}`)}
                style={styles.modalList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalRow}
                    onPress={() => {
                      setPickMovie(item);
                      setMovieModal(false);
                    }}
                  >
                    <Text style={styles.modalRowT}>{item.title}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity onPress={() => setMovieModal(false)} style={styles.modalClose}>
              <Text style={styles.link}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  emptyRoot: { flex: 1, backgroundColor: BG, paddingHorizontal: 20, justifyContent: 'center' },
  centered: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
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
  h1: { color: '#fff', fontSize: 24, fontWeight: '700' },
  bannerCaption: { color: '#ffd7db', fontSize: 14, marginTop: 6, lineHeight: 20 },
  caption: { color: MUTED, fontSize: 14, marginTop: 8, marginBottom: 20, lineHeight: 20 },
  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 24,
  },
  label: { color: MUTED, fontSize: 12, marginBottom: 8, fontWeight: '600' },
  select: {
    backgroundColor: BG,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  selectValue: { color: '#fff', fontSize: 16 },
  selectPh: { color: '#666', fontSize: 16 },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  ratingHint: { color: MUTED, fontSize: 13, marginBottom: 16 },
  textArea: {
    minHeight: 100,
    backgroundColor: BG,
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    textAlignVertical: 'top',
    marginBottom: 16,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnT: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.7 },
  hint: { color: MUTED, fontSize: 13, marginTop: 12, textAlign: 'center' },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  filterLabel: { color: MUTED, fontSize: 12, marginBottom: 8, fontWeight: '600' },
  filterSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: BG,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  filterSelectText: { flex: 1, color: '#fff', fontSize: 16 },
  filterSelectChevron: { color: MUTED, fontSize: 14, fontWeight: '700' },
  filterPickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalRowSelected: { backgroundColor: 'rgba(229,9,20,0.08)' },
  modalRowCheck: { color: ACCENT, fontSize: 16, fontWeight: '700', paddingLeft: 8 },
  mutedP: { color: MUTED, fontSize: 15, lineHeight: 22 },
  reviewCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  reviewTop: { flexDirection: 'row', gap: 12 },
  thumb: { width: 56, height: 84, borderRadius: 8, backgroundColor: '#333' },
  thumbPh: { alignItems: 'center', justifyContent: 'center' },
  thumbEm: { fontSize: 24 },
  reviewBody: { flex: 1, minWidth: 0 },
  reviewTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reviewTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600' },
  reviewActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconReviewBtn: { padding: 6, marginTop: -4 },
  editMovieTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  editModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  editSaveBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 22,
    minWidth: 100,
    alignItems: 'center',
  },
  editSaveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  reviewComment: { color: MUTED, fontSize: 14, marginTop: 6 },
  adminReplyBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#141820',
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  adminReplyLabel: { color: ACCENT, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 },
  adminReplyText: { color: '#e8e8e8', fontSize: 14, lineHeight: 20 },
  adminReplyMeta: { color: '#666', fontSize: 12, marginTop: 8 },
  link: { color: ACCENT, fontSize: 15, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 12, maxHeight: '70%' },
  modalH: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8, paddingHorizontal: 4 },
  modalList: { maxHeight: 360 },
  modalRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER, paddingHorizontal: 8 },
  modalRowT: { color: '#fff', fontSize: 16, flex: 1, paddingRight: 8 },
  modalClose: { padding: 16, alignItems: 'center' },
  deleteReviewModalWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  deleteReviewModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  deleteReviewModalCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: BORDER,
    zIndex: 1,
  },
  deleteReviewModalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  deleteReviewModalBody: { color: '#ccc', fontSize: 15, lineHeight: 22, marginBottom: 22 },
  deleteReviewModalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  deleteReviewModalBtn: {
    minWidth: 108,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteReviewModalBtnGhost: { backgroundColor: BG, borderWidth: 1, borderColor: BORDER },
  deleteReviewModalBtnGhostT: { color: '#fff', fontWeight: '600', fontSize: 15 },
  deleteReviewModalBtnDanger: { backgroundColor: '#9a1f1f' },
  deleteReviewModalBtnDangerT: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
