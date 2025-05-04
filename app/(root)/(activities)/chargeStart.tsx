import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { fetchAPI, fetchReservations } from "@/lib/fetch";
import Slider from "@react-native-community/slider";

const ChargeStart = () => {
  const { connectorId, idTag, stationName, location, tariff, connectorType } =
    useLocalSearchParams<{
      connectorId: string;
      idTag: string;
      stationName: string;
      location: string;
      tariff: string;
      connectorType: string;
    }>();
  const [chargingLimit, setChargingLimit] = useState<
    "power" | "time" | "unplanned" | "money" | "soc"
  >("unplanned");
  const [powerLevel, setPowerLevel] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [soc, setSoc] = useState<number>(100);
  const [moneyAmount, setMoneyAmount] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [sliderValue, setSliderValue] = useState<number>(50);
  const [maxPowerLimit, setMaxPowerLimit] = useState<number>(100); // in kW
  const [maxTimeLimit, setMaxTimeLimit] = useState<number>(120); // in minutes
  const [maxMoneyLimit, setMaxMoneyLimit] = useState<number>(10000); // in tenge
  let sliderTimeoutId: NodeJS.Timeout;

  // Fetch reservations and calculate maximum limits
  useEffect(() => {
    const loadReservations = async () => {
      try {
        const reservations = await fetchReservations(parseInt(connectorId));
        const currentDateTime = new Date();
        const nearestReservation = reservations
          .filter(
            (res) =>
              new Date(res.arrival_time) > currentDateTime &&
              new Date(res.arrival_time) - currentDateTime < 3600000, // within the next hour
          )
          .sort(
            (a, b) =>
              new Date(a.arrival_time).getTime() -
              new Date(b.arrival_time).getTime(),
          )[0];

        if (nearestReservation) {
          const availableTime = Math.max(
            0,
            new Date(nearestReservation.arrival_time).getTime() -
              currentDateTime.getTime() -
              300000, // 5 minutes buffer
          );
          const availableTimeInMinutes = Math.floor(availableTime / 60000);

          setMaxTimeLimit(availableTimeInMinutes);
          setMaxMoneyLimit(
            Math.round(
              (availableTimeInMinutes / 60) * parseFloat(tariff) * 100,
            ) / 100,
          );
          setMaxPowerLimit(
            Math.floor((parseFloat(tariff) * availableTimeInMinutes) / 60),
          );
        } else {
          setMaxTimeLimit(120); // Default maximum time
          setMaxMoneyLimit(10000); // Default maximum money
          setMaxPowerLimit(100); // Default maximum power
        }
      } catch (error) {
        console.error("Error fetching reservations:", error);
      }
    };

    if (connectorId) {
      loadReservations();
    }
  }, [connectorId]);

  const handleStartCharging = async () => {
    if (!connectorId || !idTag) {
      Alert.alert("Error", "Invalid connector or user information");
      return;
    }

    let isValid = true;
    switch (chargingLimit) {
      case "power":
        if (!powerLevel) {
          isValid = false;
        }
        break;
      case "time":
        if (!duration) {
          isValid = false;
        }
        break;
      case "money":
        if (moneyAmount <= 0) {
          isValid = false;
        }
        break;
      case "soc":
        if (soc <= 0) {
          isValid = false;
        }
        break;
    }

    if (!isValid) {
      Alert.alert(
        "Error",
        "Please enter valid values for your selected charging limit",
      );
      return;
    }

    try {
      setLoading(true);
      const response = await fetchAPI("/start-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: parseInt(connectorId),
          idTag,
          chargingLimit,
          ...(chargingLimit === "power" && {
            powerLevel: parseFloat(powerLevel),
          }),
          ...(chargingLimit === "time" && { duration: parseInt(duration) }),
          ...(chargingLimit === "money" && { moneyAmount }),
          ...(chargingLimit === "soc" && { soc }),
        }),
      });

      if (response.success) {
        router.push({
          pathname: "/charge",
          params: { connectorId },
        });
      } else {
        Alert.alert("Error", "Failed to start charging session");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to start charging session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Start Charging</Text>
      </View>

      <View style={styles.stationInfo}>
        <Text style={styles.stationName}>{stationName}</Text>
        <Text style={styles.stationLocation}>{location}</Text>
        <Text style={styles.connectorType}>Connector: {connectorType}</Text>
        <Text style={styles.tariff}>Tariff: {tariff} per kW</Text>
        <Text style={styles.limit}>Max Power: {maxPowerLimit} kW</Text>
        <Text style={styles.limit}>Max Time: {maxTimeLimit} minutes</Text>
        <Text style={styles.limit}>Max Amount: {maxMoneyLimit}₸</Text>
      </View>

      <View style={styles.chargingLimitSection}>
        <Text style={styles.sectionTitle}>Set charging limitation</Text>

        <View style={styles.iconButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.iconButton,
              chargingLimit === "power" && styles.selectedIconButton,
            ]}
            onPress={() => setChargingLimit("power")}
          >
            <Text style={styles.iconButtonText}>⚡</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.iconButton,
              chargingLimit === "time" && styles.selectedIconButton,
            ]}
            onPress={() => setChargingLimit("time")}
          >
            <Text style={styles.iconButtonText}>⏱️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.iconButton,
              chargingLimit === "unplanned" && styles.selectedIconButton,
            ]}
            onPress={() => setChargingLimit("unplanned")}
          >
            <Text style={styles.iconButtonText}>✓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.iconButton,
              chargingLimit === "money" && styles.selectedIconButton,
            ]}
            onPress={() => setChargingLimit("money")}
          >
            <Text style={styles.iconButtonText}>💲</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.iconButton,
              chargingLimit === "soc" && styles.selectedIconButton,
            ]}
            onPress={() => setChargingLimit("soc")}
          >
            <Text style={styles.iconButtonText}>🔋</Text>
          </TouchableOpacity>
        </View>

        {chargingLimit !== "unplanned" && (
          <View style={styles.sliderContainer}>
            {chargingLimit === "power" && (
              <>
                <Text style={styles.sliderLabel}>
                  Power (kW): {Math.round(sliderValue)}
                </Text>
                <Slider
                  style={{ width: 300, height: 40 }}
                  minimumValue={0}
                  maximumValue={maxPowerLimit}
                  step={1}
                  value={sliderValue}
                  onValueChange={(value) => {
                    clearTimeout(sliderTimeoutId);
                    sliderTimeoutId = setTimeout(() => {
                      setSliderValue(Math.round(value));
                    }, 100);
                  }}
                  onSlidingComplete={(value) => {
                    setSliderValue(Math.round(value));
                  }}
                  minimumTrackTintColor="#0000FF"
                  maximumTrackTintColor="#000000"
                  thumbTintColor="#0000FF"
                />
              </>
            )}

            {chargingLimit === "time" && (
              <>
                <Text style={styles.sliderLabel}>
                  Duration (minutes): {Math.round(sliderValue)}
                </Text>
                <Slider
                  style={{ width: 300, height: 40 }}
                  minimumValue={0}
                  maximumValue={maxTimeLimit}
                  step={1}
                  value={sliderValue}
                  onValueChange={(value) => {
                    clearTimeout(sliderTimeoutId);
                    sliderTimeoutId = setTimeout(() => {
                      setSliderValue(Math.round(value));
                    }, 100);
                  }}
                  onSlidingComplete={(value) => {
                    setSliderValue(Math.round(value));
                  }}
                  minimumTrackTintColor="#0000FF"
                  maximumTrackTintColor="#000000"
                  thumbTintColor="#0000FF"
                />
              </>
            )}

            {chargingLimit === "money" && (
              <>
                <Text style={styles.sliderLabel}>
                  Amount: {Math.round(sliderValue).toFixed(2)}₸
                </Text>
                <Slider
                  style={{ width: 300, height: 40 }}
                  minimumValue={0}
                  maximumValue={maxMoneyLimit}
                  step={1}
                  value={sliderValue}
                  onValueChange={(value) => {
                    clearTimeout(sliderTimeoutId);
                    sliderTimeoutId = setTimeout(() => {
                      setSliderValue(Math.round(value));
                    }, 100);
                  }}
                  onSlidingComplete={(value) => {
                    setSliderValue(Math.round(value));
                  }}
                  minimumTrackTintColor="#0000FF"
                  maximumTrackTintColor="#000000"
                  thumbTintColor="#0000FF"
                />
              </>
            )}

            {chargingLimit === "soc" && (
              <>
                <Text style={styles.sliderLabel}>
                  SOC: {Math.round(sliderValue)}%
                </Text>
                <Slider
                  style={{ width: 300, height: 40 }}
                  minimumValue={1}
                  maximumValue={100}
                  step={1}
                  value={sliderValue}
                  onValueChange={(value) => {
                    clearTimeout(sliderTimeoutId);
                    sliderTimeoutId = setTimeout(() => {
                      setSliderValue(Math.round(value));
                    }, 100);
                  }}
                  onSlidingComplete={(value) => {
                    setSliderValue(Math.round(value));
                  }}
                  minimumTrackTintColor="#4CAF50"
                  maximumTrackTintColor="#000000"
                />
              </>
            )}
          </View>
        )}

        {chargingLimit === "unplanned" && (
          <View style={styles.unplannedContainer}>
            <Text style={styles.unplannedText}>No limitation: full charge</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleStartCharging}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Starting..." : "Start Charging"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    fontSize: 24,
    fontWeight: "bold",
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  stationInfo: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: "center",
  },
  stationName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  stationLocation: {
    fontSize: 16,
    color: "#666",
    marginBottom: 10,
  },
  connectorType: {
    fontSize: 16,
    color: "#333",
    marginBottom: 10,
  },
  tariff: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  limit: {
    fontSize: 16,
    color: "#333",
    marginBottom: 5,
  },
  chargingLimitSection: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  iconButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#e0e0e0",
    borderRadius: 30,
    padding: 5,
    marginBottom: 20,
  },
  iconButton: {
    padding: 15,
    borderRadius: 30,
    alignItems: "center",
    width: 60,
    height: 60,
    justifyContent: "center",
  },
  selectedIconButton: {
    backgroundColor: "#4CAF50",
  },
  iconButtonText: {
    fontSize: 24,
  },
  sliderContainer: {
    marginTop: 10,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  button: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  unplannedContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  unplannedText: {
    fontSize: 16,
    color: "#666",
  },
});

export default ChargeStart;
