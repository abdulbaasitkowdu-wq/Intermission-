import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { Calendar } from 'react-native-calendars';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api/axios';

function toLocalDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Store show date as UTC noon on the chosen calendar day so listing by YYYY-MM-DD always matches. */
function dateIsoUtcNoonFromYmd(yyyyMmDd) {
  const s = yyyyMmDd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, mo, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0)).toISOString();
}

export default function AdminShowtimesScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  const [dateStr, setDateStr] = useState(() => toLocalDateString(new Date()));
  const [movies, setMovies] = useState([]);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [movieModal, setMovieModal] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [movieId, setMovieId] = useState('');
  const [time, setTime] = useState('18:00');
  const [screenNumber, setScreenNumber] = useState('1');
  const [totalSeats, setTotalSeats] = useState('');
  const [availableSeats, setAvailableSeats] = useState('');

  const resetAddForm = useCallback(() => {
    setEditingId(null);
    setMovieId('');
    setTime('18:00');
    setScreenNumber('1');
    setTotalSeats('');
    setAvailableSeats('');
  }, []);

  const loadMovies = async () => {
    try {
      const res = await api.get('/movies');
      setMovies(res.data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not load movies');
    } finally {
      setLoading(false);
    }
  };

  const loadShowtimesForDate = useCallback(async () => {
    const d = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setList([]);
      return;
    }
    setListLoading(true);
    try {
      const res = await api.get(`/showtimes/date/${d}`);
      setList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setList([]);
      Alert.alert('Error', err.response?.data?.message || 'Could not load showtimes for that date');
    } finally {
      setListLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    if (!isAdmin) return;
    loadMovies();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    loadShowtimesForDate();
  }, [isAdmin, loadShowtimesForDate, dateStr]);

  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) return;
      loadShowtimesForDate();
    }, [isAdmin, loadShowtimesForDate])
  );

  useEffect(() => {
    resetAddForm();
  }, [dateStr, resetAddForm]);

  const startEdit = st => {
    const mid = st.movie?._id != null ? st.movie._id : st.movie;
    setEditingId(st._id);
    setMovieId(mid != null ? String(mid) : '');
    setTime(st.time || '18:00');
    setScreenNumber(String(st.screenNumber ?? 1));
    setTotalSeats(st.totalSeats != null ? String(st.totalSeats) : '');
    setAvailableSeats(
      st.availableSeats != null
        ? String(st.availableSeats)
        : st.totalSeats != null
          ? String(st.totalSeats)
          : ''
    );
  };

  const selectedMovie = useMemo(
    () => movies.find((m) => String(m._id) === String(movieId)),
    [movies, movieId]
  );

  const calendarTheme = useMemo(
    () => ({
      backgroundColor: '#1c1c1c',
      calendarBackground: '#1c1c1c',
      textSectionTitleColor: '#888',
      textSectionTitleDisabledColor: '#444',
      dayTextColor: '#fff',
      todayTextColor: '#e50914',
      textDayFontWeight: '500',
      textDayFontSize: 15,
      textMonthFontWeight: '700',
      textMonthFontSize: 16,
      monthTextColor: '#fff',
      textDayHeaderFontWeight: '500',
      selectedDayBackgroundColor: '#e50914',
      selectedDayTextColor: '#fff',
      textDisabledColor: '#444',
      dotColor: '#e50914',
      selectedDotColor: '#fff',
      arrowColor: '#e50914',
    }),
    []
  );

  const markedDates = useMemo(
    () => ({
      [dateStr]: { selected: true, selectedColor: '#e50914' },
    }),
    [dateStr]
  );

  const handleSave = async () => {
    if (!isAdmin) return;
    const dateIso = dateIsoUtcNoonFromYmd(dateStr);
    if (!dateIso) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD (e.g. 2026-04-28).');
      return;
    }
    if (!movieId) {
      Alert.alert('Select a movie', 'Choose a movie from the list.');
      return;
    }
    const t = time.trim();
    if (!t) {
      Alert.alert('Time required', 'Enter a show time (e.g. 18:00).');
      return;
    }
    const screen = Number(screenNumber);
    const totalStr = totalSeats.trim();
    const availStr = availableSeats.trim();
    if (!totalStr) {
      Alert.alert('Total seats', 'Enter total seats for this screening.');
      return;
    }
    if (!availStr) {
      Alert.alert('Available seats', 'Enter how many seats are available.');
      return;
    }
    const total = Number(totalStr);
    const avail = Number(availStr);
    if (!Number.isFinite(screen) || screen < 1) {
      Alert.alert('Invalid screen', 'Screen number must be 1 or greater.');
      return;
    }
    if (!Number.isFinite(total) || total < 1) {
      Alert.alert('Invalid seats', 'Total seats must be a positive number.');
      return;
    }
    if (!Number.isFinite(avail) || avail < 0) {
      Alert.alert('Invalid seats', 'Available seats must be 0 or more.');
      return;
    }
    if (avail > total) {
      Alert.alert('Invalid seats', 'Available cannot exceed total seats.');
      return;
    }

    const body = {
      movie: String(movieId),
      date: dateIso,
      time: t,
      screenNumber: screen,
      totalSeats: total,
      availableSeats: avail,
    };

    try {
      setSubmitting(true);
      if (editingId) {
        await api.put(`/showtimes/${editingId}`, body);
        await loadShowtimesForDate();
        resetAddForm();
        Alert.alert('Success', 'Showtime updated.');
      } else {
        await api.post('/showtimes', body);
        setTotalSeats('');
        setAvailableSeats('');
        await loadShowtimesForDate();
        Alert.alert('Success', 'Showtime added.');
      }
    } catch (err) {
      Alert.alert(
        'Failed',
        err.response?.data?.message ||
          (editingId ? 'Could not update showtime' : 'Could not create showtime')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    if (!isAdmin) return;
    Alert.alert('Delete showtime', 'Remove this showtime? Existing bookings may be affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/showtimes/${id}`);
            if (editingId === id) resetAddForm();
            await loadShowtimesForDate();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Delete failed');
          }
        },
      },
    ]);
  };

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.denyText}>This screen is for administrators only.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
              <Text style={styles.title}>Showtimes</Text>
              <Text style={styles.bannerCaption} numberOfLines={1}>
                Manage showtimes for the selected date.
              </Text>
            </View>
          </View>
        </View>
        {editingId && (
          <View style={styles.editingBar}>
            <Text style={styles.editingText}>Editing a showtime — change fields, then save.</Text>
            <TouchableOpacity onPress={resetAddForm} hitSlop={8}>
              <Text style={styles.editingCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>Date</Text>
        <View style={styles.calendarCard}>
          <Calendar
            current={dateStr}
            markedDates={markedDates}
            onDayPress={day => setDateStr(day.dateString)}
            enableSwipeMonths
            theme={calendarTheme}
            style={styles.calendar}
          />
        </View>
        <Text style={styles.dateHint}>
          Selected: {dateStr} — tap any day to switch
        </Text>

        <Text style={styles.label}>Movie</Text>
        <TouchableOpacity
          style={styles.selectInput}
          onPress={() => setMovieModal(true)}
        >
          <Text style={selectedMovie ? styles.selectValue : styles.selectPlaceholder}>
            {selectedMovie ? selectedMovie.title : 'Select a movie…'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Time (24h e.g. 18:00)</Text>
        <TextInput
          style={styles.input}
          value={time}
          onChangeText={setTime}
          placeholder="18:00"
          placeholderTextColor="#666"
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Screen</Text>
            <TextInput
              style={styles.input}
              value={screenNumber}
              onChangeText={setScreenNumber}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Total seats</Text>
            <TextInput
              style={styles.input}
              value={totalSeats}
              onChangeText={setTotalSeats}
              placeholder="e.g. 80"
              placeholderTextColor="#666"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Text style={styles.label}>Available seats</Text>
        <TextInput
          style={styles.input}
          value={availableSeats}
          onChangeText={setAvailableSeats}
          placeholder="e.g. 80"
          placeholderTextColor="#666"
          keyboardType="number-pad"
        />

        <TouchableOpacity
          style={[styles.addBtn, submitting && styles.addBtnDisabled]}
          onPress={handleSave}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>
              {editingId ? 'Save changes' : 'Add showtime'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Schedule for {dateStr}</Text>
          {listLoading && <ActivityIndicator color="#e50914" size="small" />}
        </View>
        {list.length === 0 && !listLoading ? (
          <Text style={styles.muted}>No showtimes on this date yet.</Text>
        ) : (
          list.map((st) => (
            <View key={st._id} style={styles.card}>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {st.movie?.title || 'Movie'}
                </Text>
                <Text style={styles.cardLine}>
                  {st.time} · Screen {st.screenNumber} · {st.availableSeats} / {st.totalSeats} seats
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => startEdit(st)}
                style={styles.edit}
                disabled={submitting}
              >
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(st._id)}
                style={styles.trash}
              >
                <Text style={styles.trashText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={movieModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Choose movie</Text>
            <FlatList
              data={movies}
              keyExtractor={item => item._id}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => {
                    setMovieId(String(item._id));
                    setMovieModal(false);
                  }}
                >
                  <Text style={styles.modalRowText}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => setMovieModal(false)}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f0f' },
  scroll: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0f0f0f', padding: 24,
  },
  denyText: { color: '#999', textAlign: 'center', marginBottom: 20 },
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
  backBtn: { backgroundColor: '#1c1c1c', padding: 14, borderRadius: 10 },
  backBtnText: { color: '#fff' },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  bannerCaption: { color: '#ffd7db', fontSize: 14, marginTop: 6, lineHeight: 20 },
  caption: { color: '#888', fontSize: 14, marginTop: 8, marginBottom: 20, lineHeight: 20 },
  editingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#e50914',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: -8,
    marginBottom: 16,
    gap: 8,
  },
  editingText: { color: '#ccc', fontSize: 13, flex: 1 },
  editingCancel: { color: '#e50914', fontSize: 14, fontWeight: '600' },
  calendarCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1c1c1c',
    marginBottom: 8,
  },
  calendar: { borderRadius: 12 },
  dateHint: { color: '#666', fontSize: 12, marginBottom: 16 },
  label: { color: '#aaa', fontSize: 12, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: '#1c1c1c', color: '#fff', borderRadius: 10, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a', fontSize: 15,
  },
  selectInput: {
    backgroundColor: '#1c1c1c', borderRadius: 10, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#2a2a2a', justifyContent: 'center', minHeight: 50,
  },
  selectValue: { color: '#fff', fontSize: 15 },
  selectPlaceholder: { color: '#666', fontSize: 15 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, minWidth: 0 },
  addBtn: {
    backgroundColor: '#e50914', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 28,
  },
  addBtnDisabled: { opacity: 0.7 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  muted: { color: '#666', fontSize: 14, marginBottom: 12 },
  card: {
    backgroundColor: '#1c1c1c', borderRadius: 10, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#2a2a2a', flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cardLine: { color: '#999', fontSize: 13, marginTop: 4 },
  edit: { padding: 8 },
  editText: { color: '#e50914', fontSize: 14, fontWeight: '600' },
  trash: { padding: 8 },
  trashText: { color: '#c44', fontSize: 14, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24,
  },
  modalBox: {
    backgroundColor: '#1a1a1a', borderRadius: 16, maxHeight: '70%', padding: 8,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '600', padding: 12, paddingBottom: 4 },
  modalList: { maxHeight: 360 },
  modalRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  modalRowText: { color: '#fff', fontSize: 15 },
  modalClose: { padding: 16, alignItems: 'center' },
  modalCloseText: { color: '#e50914', fontSize: 16, fontWeight: '600' },
});
