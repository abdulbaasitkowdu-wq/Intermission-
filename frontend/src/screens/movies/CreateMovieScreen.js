import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/axios';

const STATUS_OPTIONS = ['Now Showing', 'Coming Soon'];

export default function CreateMovieScreen({ navigation, route }) {
  const movieToEdit = route?.params?.movie;
  const isEditMode = useMemo(() => Boolean(movieToEdit?._id), [movieToEdit]);

  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [duration, setDuration] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [description, setDescription] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [status, setStatus] = useState('Coming Soon');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!movieToEdit) return;

    setTitle(movieToEdit.title || '');
    setGenre(movieToEdit.genre || '');
    setDuration(movieToEdit.duration ? String(movieToEdit.duration) : '');
    setReleaseDate(
      movieToEdit.releaseDate
        ? new Date(movieToEdit.releaseDate).toISOString().split('T')[0]
        : ''
    );
    setDescription(movieToEdit.description || '');
    setPosterUrl(movieToEdit.posterUrl || '');
    setStatus(movieToEdit.status || 'Coming Soon');
  }, [movieToEdit]);

  const validateForm = () => {
    if (!title.trim() || !genre.trim() || !duration.trim()) {
      Alert.alert('Error', 'Title, genre, and duration are required');
      return false;
    }

    const numericDuration = Number(duration);
    if (Number.isNaN(numericDuration) || numericDuration <= 0) {
      Alert.alert('Error', 'Duration must be a valid number greater than 0');
      return false;
    }

    if (releaseDate.trim() && Number.isNaN(Date.parse(releaseDate.trim()))) {
      Alert.alert('Error', 'Release date must be a valid date (e.g. 2026-04-27)');
      return false;
    }

    return true;
  };

  const handleCreateMovie = async () => {
    if (!validateForm()) return;

    const payload = {
      title: title.trim(),
      genre: genre.trim(),
      duration: Number(duration),
      releaseDate: releaseDate.trim() || undefined,
      description: description.trim() || undefined,
      posterUrl: posterUrl.trim() || undefined,
      status,
      isTrending: isEditMode ? Boolean(movieToEdit?.isTrending) : false,
    };

    try {
      setSubmitting(true);
      if (isEditMode) {
        await api.put(`/movies/${movieToEdit._id}`, payload);
      } else {
        await api.post('/movies', payload);
      }

      Alert.alert('Success', isEditMode ? 'Movie updated successfully' : 'Movie created successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert(
        isEditMode ? 'Update Failed' : 'Create Failed',
        err.response?.data?.message || (isEditMode ? 'Unable to update movie' : 'Unable to create movie')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
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
              <Text style={styles.title}>{isEditMode ? 'Edit Movie' : 'Add New Movie'}</Text>
              <Text style={styles.subtitle}>
                {isEditMode ? 'Update current showing movie details' : 'Fill in all details before publishing'}
              </Text>
            </View>
          </View>
        </View>

        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Title *"
          placeholderTextColor="#888"
        />

        <TextInput
          style={styles.input}
          value={genre}
          onChangeText={setGenre}
          placeholder="Genre *"
          placeholderTextColor="#888"
        />

        <TextInput
          style={styles.input}
          value={duration}
          onChangeText={setDuration}
          placeholder="Duration in minutes *"
          placeholderTextColor="#888"
          keyboardType="number-pad"
        />

        <TextInput
          style={styles.input}
          value={releaseDate}
          onChangeText={setReleaseDate}
          placeholder="Release Date (YYYY-MM-DD)"
          placeholderTextColor="#888"
          autoCapitalize="none"
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          placeholderTextColor="#888"
          multiline
        />

        <TextInput
          style={styles.input}
          value={posterUrl}
          onChangeText={setPosterUrl}
          placeholder="Poster URL"
          placeholderTextColor="#888"
          autoCapitalize="none"
        />

        <Text style={styles.sectionLabel}>Status</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map(option => (
            <TouchableOpacity
              key={option}
              style={[styles.statusButton, status === option && styles.statusButtonActive]}
              onPress={() => setStatus(option)}
            >
              <Text style={[styles.statusText, status === option && styles.statusTextActive]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleCreateMovie}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>{isEditMode ? 'Update Movie' : 'Create Movie'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  inner: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 30,
  },
  topBanner: {
    backgroundColor: '#e50914',
    borderRadius: 28,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    marginBottom: 14,
    marginHorizontal: -28,
    borderWidth: 1,
    borderColor: '#c80712',
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerTextWrap: {
    flex: 1,
  },
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
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#ffd7db',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#1c1c1c',
    color: '#fff',
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    color: '#bbb',
    fontSize: 13,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statusButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1c1c1c',
    paddingVertical: 10,
    alignItems: 'center',
  },
  statusButtonActive: {
    borderColor: '#e50914',
    backgroundColor: '#e50914',
  },
  statusText: {
    color: '#bdbdbd',
    fontWeight: '500',
  },
  statusTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#e50914',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
