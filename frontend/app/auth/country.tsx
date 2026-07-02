import React, { useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, FlatList, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/colors";
import { COUNTRIES, Country } from "@/constants/country";

const CountryPickerScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [query]);

  const select = (item: Country) => {
    router.back();
    router.setParams({ code: item.code, dialCode: item.dialCode, flag: item.flag });
  };

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      {/* Scrim to allow closing by tapping outside */}
      <Pressable style={styles.scrim} onPress={() => router.back()} />

      {/* Half-height bottom sheet wrapper */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <LinearGradient
          colors={Colors.gradients.background as [string, string]}
          style={styles.sheet}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.grabber} />
          <Text style={styles.title}>Choose your country</Text>
          <TextInput
            placeholder="Search country"
            placeholderTextColor={Colors.textMuted}
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => select(item)}>
                <Text style={styles.flag}>{item.flag}</Text>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.code}>{item.dialCode}</Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            style={{ flexGrow: 0 }}
          />
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end'
  },
  keyboardAvoid: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    // Use theme-tinted scrim so the background gradient remains visible
    backgroundColor: 'rgba(7,11,20,0.35)'
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopColor: Colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '75%'
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginBottom: 8,
    opacity: 0.8
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12
  },
  search: {
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    color: Colors.textPrimary,
    marginBottom: 10
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  flag: { fontSize: 20, width: 28 },
  name: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  code: { color: Colors.textSecondary, fontSize: 14 }
});

export default CountryPickerScreen;