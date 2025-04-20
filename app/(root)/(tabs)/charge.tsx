import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { stopCharging } from "@/lib/fetch";

const Charge = () => {
  // Extract params using useLocalSearchParams
  const { connectorId, idTag } = useLocalSearchParams<{
    connectorId: string;
    idTag: string;
  }>();

  // Convert connectorId to a number
  const parsedConnectorId = Number(connectorId);

  const [status, setStatus] = useState("Charging...");
  const [transactionId, setTransactionId] = useState<number | null>(null);

  // Simulate starting a transaction (replace with actual backend logic if needed)
  useEffect(() => {
    if (!parsedConnectorId || !idTag) {
      console.error("Invalid connectorId or idTag");
      Alert.alert("Error", "Invalid charging session details.");
      router.back();
      return;
    }

    // For demonstration, assume the transaction ID is fetched from the backend
    const startTransaction = async () => {
      try {
        setTransactionId(12345); // Replace with actual transaction ID from the server
      } catch (error) {
        console.error("Error starting transaction:", error);
        Alert.alert("Error", "Failed to start the charging session.");
      }
    };

    startTransaction();
  }, [parsedConnectorId, idTag]);

  // Stop charging session
  const handleStopCharging = async () => {
    try {
      if (!transactionId) {
        throw new Error("Transaction ID is missing");
      }

      // Call the stopCharging function
      await stopCharging(parsedConnectorId, transactionId);

      // Update UI and navigate back to the Home page
      setStatus("Charging Stopped");
      Alert.alert("Success", "Charging session stopped successfully.");
      router.back(); // Navigate back to the previous page
    } catch (error) {
      console.error("Error stopping charging:", error);
      Alert.alert("Error", "Failed to stop the charging session.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Charging Session</Text>
      <Text style={styles.connectorInfo}>
        Connector ID: {parsedConnectorId}
      </Text>
      <Text style={styles.status}>Status: {status}</Text>
      {transactionId && (
        <Text style={styles.transactionInfo}>
          Transaction ID: {transactionId}
        </Text>
      )}
      <TouchableOpacity style={styles.button} onPress={handleStopCharging}>
        <Text style={styles.buttonText}>Stop Charging</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  connectorInfo: {
    fontSize: 18,
    marginBottom: 10,
  },
  status: {
    fontSize: 18,
    marginBottom: 20,
    color: "green",
  },
  transactionInfo: {
    fontSize: 16,
    marginBottom: 20,
    color: "blue",
  },
  button: {
    backgroundColor: "#ff4d4d",
    padding: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
};

export default Charge;
