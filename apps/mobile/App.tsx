import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>NextQuest</Text>
      <Text style={styles.subtitle}>Votre ludotheque videoludique</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ff9a00",
  },
  subtitle: {
    fontSize: 16,
    color: "#9ca3af",
    marginTop: 16,
  },
});
