import React, { useState, useMemo, useContext, useLayoutEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';

const HALL_H_PADDING = 32;
const ROW_V_GAP = 7;
const SEAT_SIZE_MIN = 22;
const SEAT_SIZE_MAX = 36;
const SLOT_FRACTION = 0.9;

/**
 * Editable per-row layout. One entry per screen row, top to bottom.
 * - `row`: row letter (seat ids use `${row}${n}`).
 * - `slots`: left-to-right. Each value:
 *   - a number: that seat id is `${row}${number}` (e.g. 12 → A12);
 *   - `null`: empty place (aisle) — same width as a seat so columns line up.
 * Shorter rows are right-padded with `null` to match the widest row.
 */
const ROW_SLOTS = [1, 2, 3, null, 5, 6, 7, null, 9, 10, 11];
const HALL_LAYOUT = ['A', 'B', 'C', 'D', 'E', 'F'].map(row => ({
  row,
  slots: [...ROW_SLOTS],
}));

function normalizeHallLayout(layout) {
  const max = Math.max(0, ...layout.map(r => r.slots.length));
  return layout.map(r => {
    const slots = r.slots.slice();
    while (slots.length < max) slots.push(null);
    return { row: r.row, slots };
  });
}

const HALL = normalizeHallLayout(HALL_LAYOUT);
const MAX_SLOTS = HALL[0]?.slots.length ?? 0;

const PRICE   = 10;

const accent = '#e50914';
const cardBg = '#0f0f0f';
const availableFill = '#f5f5f5';
const takenFill = '#3a3a44';

function webConfirm(message) {
  return Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm(message);
}

function webAlertLine(title, body) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(body ? `${title}\n\n${body}` : title);
    return true;
  }
  return false;
}

function SeatButton({ status, onPress, disabled, label, size }) {
  const s = size || 32;
  const isTaken = status === 'taken';
  const isSelected = status === 'selected';
  const r = Math.max(6, Math.min(10, s * 0.28));
  const labelFs = Math.max(6, Math.min(10, s * 0.27));
  return (
    <TouchableOpacity
      style={[
        styles.seat,
        { width: s, height: s, borderRadius: r },
        isTaken && styles.seatTaken,
        isSelected && styles.seatSelected,
        !isTaken && !isSelected && styles.seatAvailable,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text
        style={[
          styles.seatLabel,
          { fontSize: labelFs },
          isTaken && styles.seatLabelTaken,
          isSelected && styles.seatLabelSelected,
          !isTaken && !isSelected && styles.seatLabelAvailable,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        maxFontSizeMultiplier={1.1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function BookingScreen({ route, navigation }) {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';
  const adminBounce = useRef(false);
  const params = route.params || {};
  const { showtimeId, movieTitle, showtime, takenSeats = [] } = params;
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();

  useLayoutEffect(() => {
    if (isAdmin && !adminBounce.current) {
      adminBounce.current = true;
      navigation.goBack();
    }
  }, [isAdmin, navigation]);

  const seatSize = useMemo(() => {
    const w = Math.max(1, winW - HALL_H_PADDING);
    const colW = w / Math.max(1, MAX_SLOTS);
    return Math.min(
      SEAT_SIZE_MAX,
      Math.max(SEAT_SIZE_MIN, Math.floor(colW * SLOT_FRACTION))
    );
  }, [winW, MAX_SLOTS]);

  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(false);

  const takenSet = useMemo(() => new Set((takenSeats || []).map((s) => String(s))), [takenSeats]);

  const toggleSeat = seatId => {
    if (takenSet.has(String(seatId))) return;
    setSelectedSeats(prev =>
      prev.includes(seatId) ? prev.filter(s => s !== seatId) : [...prev, seatId]
    );
  };

  const getSeatStatus = seatId => {
    if (takenSet.has(String(seatId))) return 'taken';
    if (selectedSeats.includes(seatId)) return 'selected';
    return 'available';
  };

  const goToBookingsTab = useCallback(() => {
    try {
      navigation.popToTop?.();
    } catch {
      /* popToTop may be unavailable on some web stacks */
    }
    navigation.navigate('Main', { screen: 'Bookings' });
  }, [navigation]);

  const confirmBooking = useCallback(async () => {
    try {
      setLoading(true);
      await api.post('/bookings', { showtimeId, seats: selectedSeats });
      const seatList = selectedSeats.join(', ');
      if (webAlertLine('Booking confirmed', `Seats: ${seatList}`)) {
        goToBookingsTab();
      } else {
        Alert.alert('Booking confirmed', `Seats: ${seatList}`, [{ text: 'OK', onPress: goToBookingsTab }]);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong';
      if (!webAlertLine('Booking failed', msg)) {
        Alert.alert('Booking failed', msg);
      }
    } finally {
      setLoading(false);
    }
  }, [goToBookingsTab, selectedSeats, showtimeId]);

  const handleBooking = () => {
    if (selectedSeats.length === 0) {
      if (!webAlertLine('No seats selected', 'Please select at least one seat.')) {
        Alert.alert('No seats selected', 'Please select at least one seat');
      }
      return;
    }
    const detail = `Book ${selectedSeats.length} seat(s) for $${selectedSeats.length * PRICE}?\n\nSeats: ${selectedSeats.join(', ')}`;
    if (webConfirm(detail)) {
      void confirmBooking();
      return;
    }
    if (Platform.OS !== 'web') {
      Alert.alert('Confirm booking', detail, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => void confirmBooking() },
      ]);
    }
  };

  if (isAdmin) {
    return null;
  }

  if (!showtimeId || !showtime) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>
          Open a movie, pick a showtime, then select seats to book.
        </Text>
        <TouchableOpacity style={styles.footerBook} onPress={() => navigation.goBack()}>
          <Text style={styles.footerBookText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.topRow, { paddingTop: 8 }]}>
          <TouchableOpacity
            style={styles.backCircle}
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {movieTitle}
          </Text>
        </View>

        <View style={styles.subHeader}>
          <Text style={styles.subTitle}>
            {showtime.time} · Screen {showtime.screenNumber}
          </Text>
        </View>

        {/* Curved "screen" + soft glow (red theme) */}
        <View style={styles.screenBlock}>
          <View style={styles.screenGlow} />
          <View style={styles.screenCurve} />
        </View>

        <View style={styles.hall}>
          {HALL.map(({ row, slots }) => (
            <View key={row} style={styles.hallRow}>
              <View style={styles.seatRow}>
                {slots.map((col, i) => {
                  if (col == null) {
                    return (
                      <View key={`${row}-gap-${i}`} style={styles.seatCol}>
                        <View style={{ width: seatSize, height: seatSize }} />
                      </View>
                    );
                  }
                  const id = `${row}${col}`;
                  return (
                    <View key={id} style={styles.seatCol}>
                      <SeatButton
                        label={id}
                        size={seatSize}
                        status={getSeatStatus(id)}
                        disabled={getSeatStatus(id) === 'taken'}
                        onPress={() => toggleSeat(id)}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: availableFill }]} />
            <Text style={styles.legendText}>Available</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: accent }]} />
            <Text style={styles.legendText}>Selected</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: takenFill }]} />
            <Text style={styles.legendText}>Reserved</Text>
          </View>
        </View>

        {selectedSeats.length > 0 && (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              Selected:{' '}
              <Text style={styles.summaryBold}>{[...selectedSeats].sort().join(', ')}</Text>
            </Text>
            <Text style={styles.summaryText}>
              Total:{' '}
              <Text style={styles.summaryBold}>
                ${selectedSeats.length * PRICE}
              </Text>
            </Text>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.footerBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.footerBook,
            (loading || selectedSeats.length === 0) && styles.footerBookDisabled,
          ]}
          onPress={handleBooking}
          disabled={loading || selectedSeats.length === 0}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.footerBookText}>
              {selectedSeats.length === 0
                ? 'Select seats'
                : `Book ${selectedSeats.length} · $${selectedSeats.length * PRICE}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: cardBg },
  scroll: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    marginLeft: 14,
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  subHeader: { paddingHorizontal: 20, marginBottom: 4 },
  subTitle: { color: '#8a8a8a', fontSize: 14, marginTop: 2 },
  screenBlock: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 44,
  },
  screenGlow: {
    position: 'absolute',
    top: 8,
    width: '80%',
    height: 32,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
  },
  screenCurve: {
    width: '80%',
    height: 4,
    borderWidth: 2.5,
    borderColor: accent,
    borderBottomWidth: 0,
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    backgroundColor: 'transparent',
  },
  hall: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    alignItems: 'stretch',
  },
  hallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ROW_V_GAP,
  },
  seatRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
  },
  seatCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seat: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  seatLabel: {
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 1,
  },
  seatLabelAvailable: {
    color: '#1a1a1a',
  },
  seatLabelSelected: {
    color: '#fff',
  },
  seatLabelTaken: {
    color: 'rgba(255,255,255,0.45)',
  },
  seatAvailable: {
    backgroundColor: availableFill,
  },
  seatSelected: {
    backgroundColor: accent,
    borderWidth: 0,
  },
  seatTaken: {
    backgroundColor: takenFill,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingVertical: 18,
    marginHorizontal: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10, marginBottom: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  summary: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  summaryText: { color: '#999', fontSize: 14, marginTop: 4 },
  summaryBold: { color: '#fff', fontWeight: '600' },
  footerBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: cardBg,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  footerBook: {
    backgroundColor: accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerBookDisabled: { backgroundColor: '#333' },
  footerBookText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  missing: {
    flex: 1,
    backgroundColor: cardBg,
    justifyContent: 'center',
    padding: 24,
  },
  missingText: { color: '#999', fontSize: 16, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
});
