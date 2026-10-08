import React, { useState, useCallback, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';

const BG = '#0f0f0f';
const CARD = '#1c1c1c';
const BORDER = '#2a2a2a';
const ACCENT = '#e50914';
const MUTED = '#888';

function statusStyle(st) {
  if (st === 'approved') return { bg: 'rgba(46,160,67,0.2)', color: '#3fb950' };
  if (st === 'rejected') return { bg: 'rgba(196,68,68,0.2)', color: '#c44' };
  return { bg: 'rgba(255,200,0,0.12)', color: '#d4a017' };
}

function hasVoted(s, userId) {
  if (!userId || !s?.votedBy?.length) return false;
  return s.votedBy.some(id => String(id) === String(userId));
}

function suggestionStatus(s) {
  return s?.status || 'pending';
}

function isOwner(s, userId) {
  if (!userId) return false;
  const uid = s.user?._id != null ? s.user._id : s.user;
  return String(uid) === String(userId);
}

export default function SuggestionScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const tabBarHeight = useBottomTabBarHeight();
  const userId = user?._id ?? user?.id;

  const [tab, setTab] = useState('all');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingEdit, setPendingEdit] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    try {
      if (tab === 'mine' && user) {
        const res = await api.get('/suggestions/my');
        setList(Array.isArray(res.data) ? res.data : []);
      } else {
        const res = await api.get('/suggestions');
        setList(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      setList([]);
      if (tab === 'mine' && err.response?.status === 401) {
        /* not logged in */
      } else {
        console.warn(err.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const submit = async () => {
    if (!user) {
      Alert.alert('Sign in', 'Log in to suggest a movie.');
      return;
    }
    const t = title.trim();
    if (t.length < 2) {
      Alert.alert('Title', 'Enter a movie title (at least 2 characters).');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/suggestions', {
        movieTitle: t,
        description: description.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      setTab('mine');
      const mine = await api.get('/suggestions/my');
      setList(Array.isArray(mine.data) ? mine.data : []);
      Alert.alert('Submitted', 'Your request is on the list. Others can upvote it.');
    } catch (err) {
      Alert.alert('Could not submit', err.response?.data?.message || 'Try again');
    } finally {
      setSubmitting(false);
    }
  };

  const vote = async id => {
    if (!user) return;
    try {
      setVotingId(id);
      await api.put(`/suggestions/${id}/vote`);
      await load();
    } catch (err) {
      Alert.alert('Vote', err.response?.data?.message || 'Could not vote');
    } finally {
      setVotingId(null);
    }
  };

  const confirmRemoveSuggestion = async () => {
    if (!pendingDelete?._id) return;
    try {
      setDeleting(true);
      await api.delete(`/suggestions/${pendingDelete._id}`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = s => {
    setPendingEdit(s);
    setEditTitle(s.movieTitle || '');
    setEditDescription(typeof s.description === 'string' ? s.description : '');
  };

  const closeEdit = () => {
    if (savingEdit) return;
    setPendingEdit(null);
    setEditTitle('');
    setEditDescription('');
  };

  const saveEdit = async () => {
    if (!pendingEdit?._id) return;
    const t = editTitle.trim();
    if (t.length < 2) {
      Alert.alert('Title', 'Enter a movie title (at least 2 characters).');
      return;
    }
    try {
      setSavingEdit(true);
      await api.put(`/suggestions/${pendingEdit._id}`, {
        movieTitle: t,
        description: editDescription.trim(),
      });
      setPendingEdit(null);
      setEditTitle('');
      setEditDescription('');
      await load();
      Alert.alert('Saved', 'Your request was updated.');
    } catch (err) {
      Alert.alert('Could not save', err.response?.data?.message || 'Try again');
    } finally {
      setSavingEdit(false);
    }
  };

  const renderItem = ({ item: s }) => {
    const own = isOwner(s, userId);
    const voted = hasVoted(s, userId);
    const stKey = suggestionStatus(s);
    const st = statusStyle(stKey);
    const isPending = stKey === 'pending';
    const canUpvote = stKey === 'pending' || stKey === 'approved';
    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHead}>
          <Text style={styles.requestTitle} numberOfLines={2}>
            {s.movieTitle}
          </Text>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeT, { color: st.color }]}>
              {isPending ? 'Pending' : stKey}
            </Text>
          </View>
        </View>
        {s.user?.name && (
          <Text style={styles.byLine}>By {s.user.name}</Text>
        )}
        {s.description ? (
          <Text style={styles.desc}>{s.description}</Text>
        ) : null}
        <View style={styles.requestFoot}>
          <Text style={styles.votes}>{s.votes ?? 0} votes</Text>
          <View style={styles.footActions}>
            {user && !own && canUpvote && (
              <TouchableOpacity
                style={[styles.voteBtn, (voted || votingId === s._id) && styles.voteBtnOff]}
                onPress={() => !voted && vote(s._id)}
                disabled={voted || votingId === s._id}
              >
                {votingId === s._id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.voteBtnT}>{voted ? 'Voted' : 'Upvote'}</Text>
                )}
              </TouchableOpacity>
            )}
            {user && own && isPending && (
              <>
                <Pressable
                  onPress={() => openEdit(s)}
                  hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                  style={({ pressed }) => [styles.editPress, pressed && styles.editPressPressed]}
                >
                  <Text style={styles.editT}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPendingDelete(s)}
                  hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                  style={({ pressed }) => [styles.deletePress, pressed && styles.deletePressPressed]}
                >
                  <Text style={styles.dangerT}>Delete</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  const padTop = 8;
  const padBottom = tabBarHeight + 24;
  const showMine = tab === 'mine';

  return (
    <View style={[styles.root, { paddingTop: padTop }]}>
      <View style={styles.headerBlock}>
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
              <Text style={styles.h1}>Movie requests</Text>
              <Text style={styles.bannerCaption}>
                Suggest a title for our lineup. Other users can upvote pending and approved requests.
              </Text>
            </View>
          </View>
        </View>

        {user && (
          <View style={styles.formCard}>
            <Text style={styles.label}>Movie title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Dune: Part Three"
              placeholderTextColor="#666"
            />
            <Text style={styles.label}>Why it should play (optional)</Text>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Short reason…"
              placeholderTextColor="#666"
              multiline
            />
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDis]}
              onPress={submit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitT}>Submit request</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, !showMine && styles.tabOn]}
            onPress={() => setTab('all')}
          >
            <Text style={[styles.tabT, !showMine && styles.tabTOn]}>All requests</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, showMine && styles.tabOn]}
            onPress={() => {
              if (!user) {
                Alert.alert('Sign in', 'Log in to see your requests.');
                return;
              }
              setTab('mine');
            }}
          >
            <Text style={[styles.tabT, showMine && styles.tabTOn]}>My requests</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: padBottom, flexGrow: 1 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {showMine
                ? 'You haven’t submitted a request yet.'
                : 'No requests yet. Be the first to suggest a movie!'}
            </Text>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
          }
        />
      )}

      <Modal
        visible={pendingEdit != null}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <View style={styles.deleteModalWrap}>
          <Pressable style={styles.deleteModalBackdrop} onPress={closeEdit} />
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Edit request</Text>
            <Text style={styles.label}>Movie title</Text>
            <TextInput
              style={styles.input}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Movie title"
              placeholderTextColor="#666"
              editable={!savingEdit}
            />
            <Text style={styles.label}>Why it should play (optional)</Text>
            <TextInput
              style={styles.textArea}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Short reason…"
              placeholderTextColor="#666"
              multiline
              editable={!savingEdit}
            />
            <Text style={styles.editHint}>
              Approved requests cannot be edited.
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalBtnGhost]}
                onPress={closeEdit}
                disabled={savingEdit}
              >
                <Text style={styles.deleteModalBtnGhostT}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.editSaveBtn]}
                onPress={() => void saveEdit()}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editSaveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pendingDelete != null}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setPendingDelete(null)}
      >
        <View style={styles.deleteModalWrap}>
          <Pressable
            style={styles.deleteModalBackdrop}
            onPress={() => !deleting && setPendingDelete(null)}
          />
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Delete this request?</Text>
            <Text style={styles.deleteModalBody}>
              {`This will remove "${pendingDelete?.movieTitle ?? ''}" from the list. You cannot undo this.`}
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalBtnGhost]}
                onPress={() => !deleting && setPendingDelete(null)}
                disabled={deleting}
              >
                <Text style={styles.deleteModalBtnGhostT}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalBtnDanger]}
                onPress={confirmRemoveSuggestion}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteModalBtnDangerT}>Delete</Text>
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
  headerBlock: { paddingHorizontal: 20 },
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
  caption: { color: MUTED, fontSize: 14, marginTop: 8, marginBottom: 16, lineHeight: 20 },
  formCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  label: { color: MUTED, fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  submitBtn: { backgroundColor: ACCENT, borderRadius: 12, padding: 16, alignItems: 'center' },
  submitT: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDis: { opacity: 0.7 },
  tabs: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: 'center' },
  tabOn: { borderColor: ACCENT, backgroundColor: 'rgba(229,9,20,0.12)' },
  tabT: { color: MUTED, fontWeight: '600', fontSize: 14 },
  tabTOn: { color: ACCENT },
  centered: { flex: 1, justifyContent: 'center' },
  requestCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  requestHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  requestTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '600' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeT: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  byLine: { color: MUTED, fontSize: 12, marginBottom: 6 },
  desc: { color: '#ccc', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  requestFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  footActions: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' },
  votes: { color: MUTED, fontSize: 13, fontWeight: '600', flexShrink: 0 },
  voteBtn: { backgroundColor: ACCENT, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, minWidth: 88, alignItems: 'center' },
  voteBtnOff: { backgroundColor: '#333' },
  voteBtnT: { color: '#fff', fontWeight: '700', fontSize: 14 },
  dangerT: { color: '#c44', fontWeight: '600', fontSize: 14 },
  editT: { color: ACCENT, fontWeight: '600', fontSize: 14 },
  editPress: { paddingVertical: 8, paddingHorizontal: 4, justifyContent: 'center' },
  editPressPressed: { opacity: 0.75 },
  deletePress: { paddingVertical: 8, paddingHorizontal: 4, justifyContent: 'center' },
  deletePressPressed: { opacity: 0.75 },
  editHint: { color: MUTED, fontSize: 12, marginBottom: 16, lineHeight: 17 },
  editSaveBtn: { backgroundColor: ACCENT },
  editSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  deleteModalWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  deleteModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  deleteModalCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: BORDER,
  },
  deleteModalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  deleteModalBody: { color: '#ccc', fontSize: 15, lineHeight: 22, marginBottom: 22 },
  deleteModalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  deleteModalBtn: {
    minWidth: 108,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalBtnGhost: { backgroundColor: BG, borderWidth: 1, borderColor: BORDER },
  deleteModalBtnGhostT: { color: '#fff', fontWeight: '600', fontSize: 15 },
  deleteModalBtnDanger: { backgroundColor: '#9a1f1f' },
  deleteModalBtnDangerT: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { color: MUTED, textAlign: 'center', marginTop: 32, fontSize: 15 },
});
