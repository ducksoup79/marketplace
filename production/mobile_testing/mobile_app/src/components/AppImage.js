import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { imageUrl, getThumbPath } from '../api';
import { colors } from '../theme';

/**
 * Remote image with disk caching and optional thumbnail for list/card views.
 * useThumb=true loads /uploads/thumb/xxx.jpg (smaller, faster) instead of full size.
 */
export default function AppImage({ path, style, placeholderStyle, contentFit = 'cover', placeholderText = '📦', useThumb = false }) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathToUse = useThumb ? (getThumbPath(path) || path) : path;
  const uri = imageUrl(pathToUse);

  if (!path || !uri) {
    return (
      <View style={[styles.placeholder, style, placeholderStyle]}>
        <Text style={styles.placeholderText}>{placeholderText}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.placeholder, style, placeholderStyle]}>
        <Text style={styles.placeholderText}>{placeholderText}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      {loading ? (
        <View style={[StyleSheet.absoluteFill, styles.placeholder, placeholderStyle]}>
          <Text style={styles.placeholderText}>{placeholderText}</Text>
        </View>
      ) : null}
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        onError={() => setError(true)}
        onLoad={() => setLoading(false)}
        transition={200}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 28,
  },
});
