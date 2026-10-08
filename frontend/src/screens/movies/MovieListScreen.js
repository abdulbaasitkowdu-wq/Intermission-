import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Image,
  RefreshControl,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';

/** Genre chips — `id` is matched as a substring of `movie.genre` (case-insensitive). */
const categories = [
  { id: 'All', label: 'All', icon: '🎬' },
  { id: 'Action', label: 'Action', icon: '⚔️' },
  { id: 'Adventure', label: 'Adventure', icon: '🧭' },
  { id: 'Animation', label: 'Animation', icon: '🎨' },
  { id: 'Biography', label: 'Biography', icon: '📖' },
  { id: 'Comedy', label: 'Comedy', icon: '😂' },
  { id: 'Crime', label: 'Crime', icon: '🔫' },
  { id: 'Documentary', label: 'Documentary', icon: '📽️' },
  { id: 'Drama', label: 'Drama', icon: '🎭' },
  { id: 'Family', label: 'Family', icon: '👨‍👩‍👧' },
  { id: 'Fantasy', label: 'Fantasy', icon: '✨' },
  { id: 'History', label: 'History', icon: '🏛️' },
  { id: 'Horror', label: 'Horror', icon: '👻' },
  { id: 'Music', label: 'Music', icon: '🎵' },
  { id: 'Musical', label: 'Musical', icon: '🎤' },
  { id: 'Mystery', label: 'Mystery', icon: '🔎' },
  { id: 'Romance', label: 'Romance', icon: '💕' },
  { id: 'Sci-Fi', label: 'Sci-Fi', icon: '🛸' },
  { id: 'Science Fiction', label: 'Science Fiction', icon: '🚀' },
  { id: 'Sport', label: 'Sport', icon: '⚽' },
  { id: 'TV Movie', label: 'TV Movie', icon: '📺' },
  { id: 'Superhero', label: 'Superhero', icon: '🦸' },
  { id: 'Thriller', label: 'Thriller', icon: '🎯' },
  { id: 'War', label: 'War', icon: '🎖️' },
  { id: 'Western', label: 'Western', icon: '🤠' },
];

export default function MovieListScreen({ navigation }) {
  const { user, logout } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';
  const tabBarHeight = useBottomTabBarHeight();

  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [pendingDeleteMovie, setPendingDeleteMovie] = useState(null);
  const [deleteMovieSubmitting, setDeleteMovieSubmitting] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [renderSearchDropdown, setRenderSearchDropdown] = useState(false);
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  const fetchMovies = async () => {
    try {
      const res = await api.get('/movies');
      setMovies(res.data);
    } catch (err) {
      console.log('Error fetching movies:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMovies();
  };

  const filteredMovies = useMemo(() => {
    let result = movies;

    if (activeCategory !== 'All') {
      result = result.filter(movie =>
        (movie.genre || '').toLowerCase().includes(activeCategory.toLowerCase())
      );
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(movie => (movie.title || '').toLowerCase().includes(query));
    }

    return result;
  }, [movies, activeCategory, search]);

  const nowInCinemas = useMemo(
    () => filteredMovies.filter(movie => movie.status === 'Now Showing'),
    [filteredMovies]
  );

  const comingSoonMovies = useMemo(
    () => filteredMovies.filter(movie => movie.status === 'Coming Soon'),
    [filteredMovies]
  );

  const adminMovies = useMemo(() => {
    if (!search.trim()) return movies;
    const query = search.toLowerCase();
    return movies.filter(movie => (movie.title || '').toLowerCase().includes(query));
  }, [movies, search]);

  const searchSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return movies
      .filter(movie => (movie.title || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [movies, search]);

  const showSearchDropdown = !isAdmin && searchFocused && search.trim().length > 0;

  useEffect(() => {
    if (showSearchDropdown) {
      setRenderSearchDropdown(true);
      Animated.timing(dropdownAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(dropdownAnim, {
      toValue: 0,
      duration: 130,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRenderSearchDropdown(false);
    });
  }, [dropdownAnim, showSearchDropdown]);

  const confirmDeleteMovie = async () => {
    if (!pendingDeleteMovie?._id) return;
    const id = pendingDeleteMovie._id;
    try {
      setDeleteMovieSubmitting(true);
      await api.delete(`/movies/${id}`);
      setMovies(prev => prev.filter(movie => movie._id !== id));
      setPendingDeleteMovie(null);
      Alert.alert('Success', 'Movie archived. It no longer appears in the catalog; bookings and reviews keep the title.');
    } catch (err) {
      Alert.alert('Archive failed', err.response?.data?.message || 'Unable to archive movie');
    } finally {
      setDeleteMovieSubmitting(false);
    }
  };

  const renderPosterCard = ({ item }) => (
    <TouchableOpacity
      style={styles.posterCard}
      activeOpacity={0.85}
      delayPressIn={70}
      onPress={() => navigation.navigate('MovieDetail', { movieId: item._id })}
    >
      {item.posterUrl ? (
        <Image source={{ uri: item.posterUrl }} style={styles.posterImage} />
      ) : (
        <View style={styles.posterFallback}>
          <Text style={styles.posterFallbackEmoji}>🎬</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderPopularRow = ({ item }) => (
    <TouchableOpacity
      style={styles.popularRow}
      activeOpacity={0.85}
      delayPressIn={70}
      onPress={() => navigation.navigate('MovieDetail', { movieId: item._id })}
    >
      {item.posterUrl ? (
        <Image source={{ uri: item.posterUrl }} style={styles.popularPoster} />
      ) : (
        <View style={styles.popularPosterFallback}>
          <Text style={styles.posterFallbackEmoji}>🎬</Text>
        </View>
      )}

      <View style={styles.popularInfo}>
        <Text style={styles.popularTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.popularMeta} numberOfLines={1}>
          {item.genre} • {item.duration} min
        </Text>
        <View style={styles.badgeRow}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{item.status}</Text>
          </View>
          {item.isTrending && (
            <View style={styles.trendingBadge}>
              <Text style={styles.trendingBadgeText}>Trending</Text>
            </View>
          )}
          {isAdmin && item.status === 'Now Showing' && (
            <TouchableOpacity
              style={styles.inlineAction}
              onPress={() => navigation.navigate('CreateMovie', { movie: item })}
            >
              <Text style={styles.inlineActionText}>Edit</Text>
            </TouchableOpacity>
          )}
          {isAdmin && (
            <Pressable
              style={({ pressed }) => [
                styles.inlineAction,
                styles.deleteAction,
                pressed && styles.inlineActionPressed,
              ]}
              onPress={() => setPendingDeleteMovie(item)}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.inlineActionText}>Archive</Text>
            </Pressable>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderAdminMovieRow = ({ item }) => (
    <View style={styles.popularRow}>
      <TouchableOpacity
        activeOpacity={0.85}
        delayPressIn={70}
        onPress={() => navigation.navigate('MovieDetail', { movieId: item._id })}
      >
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.popularPoster} />
        ) : (
          <View style={styles.popularPosterFallback}>
            <Text style={styles.posterFallbackEmoji}>🎬</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.popularInfo}>
        <TouchableOpacity
          activeOpacity={0.85}
          delayPressIn={70}
          onPress={() => navigation.navigate('MovieDetail', { movieId: item._id })}
        >
          <Text style={styles.popularTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.popularMeta} numberOfLines={1}>
            {item.genre} • {item.duration} min
          </Text>
        </TouchableOpacity>
        <View style={styles.badgeRow}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{item.status}</Text>
          </View>
          {item.isTrending && (
            <View style={styles.trendingBadge}>
              <Text style={styles.trendingBadgeText}>Trending</Text>
            </View>
          )}
          <Pressable
            style={({ pressed }) => [styles.inlineAction, pressed && styles.inlineActionPressed]}
            onPress={() => navigation.navigate('CreateMovie', { movie: item })}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={styles.inlineActionText}>Edit</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.inlineAction,
              styles.deleteAction,
              pressed && styles.inlineActionPressed,
            ]}
            onPress={() => setPendingDeleteMovie(item)}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          >
            <Text style={styles.inlineActionText}>Archive</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: 28 + tabBarHeight }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e50914" />
        }
      >
        <View style={styles.topBanner}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hello, {user?.name || 'User'}</Text>
              <Text style={styles.subtitle}>Let's book your favorite film</Text>
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity style={styles.iconButton} onPress={logout}>
                <Text style={styles.iconText}>⎋</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TextInput
          style={styles.search}
          placeholder="Search movie title..."
          placeholderTextColor="#666"
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 140)}
        />
        {renderSearchDropdown && (
          <Animated.View
            style={[
              styles.searchDropdown,
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
            {searchSuggestions.length === 0 ? (
              <Text style={styles.searchDropdownEmpty}>No matching movies</Text>
            ) : (
              searchSuggestions.map(item => (
                <TouchableOpacity
                  key={item._id}
                  style={styles.searchDropdownItem}
                  onPress={() => {
                    setSearch(item.title || '');
                    setSearchFocused(false);
                    navigation.navigate('MovieDetail', { movieId: item._id });
                  }}
                >
                  <Text style={styles.searchDropdownItemTitle}>{item.title}</Text>
                  <Text style={styles.searchDropdownItemMeta}>
                    {item.genre} • {item.duration} min
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </Animated.View>
        )}

        {isAdmin ? (
          <>
            <View style={[styles.sectionHeader, styles.adminSectionHeader]}>
              <Text style={[styles.sectionTitle, styles.adminSectionTitle]}>All Movies</Text>
            </View>
            {adminMovies.length === 0 ? (
              <Text style={styles.empty}>No movies found</Text>
            ) : (
              adminMovies.map(item => <View key={item._id}>{renderAdminMovieRow({ item })}</View>)
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Categories</Text>
            <FlatList
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              data={categories}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.categoryList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = activeCategory === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setActiveCategory(item.id)}
                    delayPressIn={80}
                  >
                    <Text style={styles.categoryIcon}>{item.icon}</Text>
                    <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Now in cinemas</Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('BrowseMovies', {
                    status: 'Now Showing',
                    category: activeCategory,
                    search: search.trim(),
                  })
                }
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              >
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {nowInCinemas.length ? (
              <FlatList
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                data={nowInCinemas}
                keyExtractor={item => item._id}
                renderItem={renderPosterCard}
                contentContainerStyle={styles.posterRail}
                keyboardShouldPersistTaps="handled"
              />
            ) : (
              <Text style={styles.empty}>No current showings found</Text>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Coming soon</Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('BrowseMovies', {
                    status: 'Coming Soon',
                    category: activeCategory,
                    search: search.trim(),
                  })
                }
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              >
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {comingSoonMovies.length === 0 ? (
              <Text style={styles.empty}>No coming soon titles match your search or category.</Text>
            ) : (
              comingSoonMovies.map(item => <View key={item._id}>{renderPopularRow({ item })}</View>)
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={pendingDeleteMovie != null}
        transparent
        animationType="fade"
        onRequestClose={() => !deleteMovieSubmitting && setPendingDeleteMovie(null)}
      >
        <View style={styles.deleteModalWrap}>
          <Pressable
            style={styles.deleteModalBackdrop}
            onPress={() => !deleteMovieSubmitting && setPendingDeleteMovie(null)}
          />
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Archive this movie?</Text>
            <Text style={styles.deleteModalBody}>
              {`"${pendingDeleteMovie?.title ?? ''}" will be removed from the home list and movie pages. Past bookings, Archive, Watched, and reviews will still show this title. You cannot attach new showtimes to this listing.`}
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalBtnGhost]}
                onPress={() => !deleteMovieSubmitting && setPendingDeleteMovie(null)}
                disabled={deleteMovieSubmitting}
              >
                <Text style={styles.deleteModalBtnGhostT}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalBtn, styles.deleteModalBtnDanger]}
                onPress={confirmDeleteMovie}
                disabled={deleteMovieSubmitting}
              >
                {deleteMovieSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteModalBtnDangerT}>Archive</Text>
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
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 28 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' },
  topBanner: {
    backgroundColor: '#e50914',
    borderRadius: 28,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    marginBottom: 10,
    marginHorizontal: -24,
    borderWidth: 1,
    borderColor: '#c80712',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#ffd7db', fontSize: 14, marginTop: 4 },
  headerButtons: { flexDirection: 'row', gap: 10 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  search: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 0,
    backgroundColor: '#0f0f0f',
  },
  searchDropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#151515',
  },
  searchDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#242424',
  },
  searchDropdownItemTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchDropdownItemMeta: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  searchDropdownEmpty: {
    color: '#999',
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  sectionTitle: { color: '#fff', fontSize: 29, fontWeight: '700', marginTop: 22, marginBottom: 12 },
  adminSectionTitle: { marginTop: 0, marginBottom: 8 },
  categoryList: { paddingBottom: 8, gap: 10 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 6,
  },
  categoryChipActive: { borderColor: '#e50914', backgroundColor: '#2a1113' },
  categoryIcon: { fontSize: 13 },
  categoryLabel: { color: '#d5d5d5', fontSize: 13, fontWeight: '500' },
  categoryLabelActive: { color: '#fff' },
  sectionHeader: { marginTop: 18, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  adminSectionHeader: { marginTop: 6, marginBottom: 2 },
  seeAll: { color: '#e50914', fontSize: 15, fontWeight: '600' },
  posterRail: { paddingBottom: 2, gap: 12 },
  posterCard: {
    width: 154,
    height: 220,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1c1c1c',
  },
  posterImage: { width: '100%', height: '100%' },
  posterFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  posterFallbackEmoji: { fontSize: 30 },
  popularRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderRadius: 14,
    marginBottom: 8,
  },
  popularPoster: {
    width: 84,
    height: 108,
    borderRadius: 14,
    backgroundColor: '#1c1c1c',
  },
  popularPosterFallback: {
    width: 84,
    height: 108,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  popularInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  popularTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  popularMeta: { color: '#bcbcbc', fontSize: 13, marginTop: 5 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 7,
    backgroundColor: '#2a2a2a',
  },
  statusBadgeText: { color: '#dadada', fontSize: 11, fontWeight: '500' },
  trendingBadge: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 7,
    backgroundColor: '#2a2a2a',
  },
  trendingBadgeText: { color: '#dadada', fontSize: 11, fontWeight: '500' },
  inlineAction: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: '#e50914',
    minWidth: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteAction: { backgroundColor: '#6d171c' },
  inlineActionPressed: { opacity: 0.82 },
  inlineActionText: { color: '#fff', fontSize: 11, fontWeight: '600' },
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
    backgroundColor: '#1c1c1c',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#2a2a2a',
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
  deleteModalBtnGhost: { backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: '#2a2a2a' },
  deleteModalBtnGhostT: { color: '#fff', fontWeight: '600', fontSize: 15 },
  deleteModalBtnDanger: { backgroundColor: '#9a1f1f' },
  deleteModalBtnDangerT: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { color: '#999', marginTop: 10, fontSize: 14 },
});