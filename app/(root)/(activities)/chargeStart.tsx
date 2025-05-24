import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import {
  fetchConnectorDetails,
  fetchReservations,
  startCharging,
} from "@/lib/fetch";
import Slider from "@react-native-community/slider";
import tenge from "@/assets/icons/tenge.png";
import lighting from "@/assets/icons/ligthing.png";
import time from "@/assets/icons/time.png";
import battery from "@/assets/icons/battery.png";
import ccs from "@/assets/icons/ccs.png";
import ccstp2 from "@/assets/icons/ccstp2.png";
import chademo from "@/assets/icons/chademo.png";
import gbt from "@/assets/icons/gbt.png";
import { useUser } from "@/contexts/UserContext";

type ConnectorType = "CCS" | "Type 2" | "CHAdeMO" | "GBT";

const ChargeStart = () => {
  const { connectorId } = useLocalSearchParams<{ connectorId: string }>();
  const parsedConnectorId = parseInt(connectorId);
  const [chargingLimit, setChargingLimit] = useState<
    "power" | "time" | "unplanned" | "money" | "soc"
  >("unplanned");
  const [sliderValue, setSliderValue] = useState<number>(50);
  const [availableTime, setAvailableTime] = useState<number>(360); // in minutes
  const [maxPower, setMaxPower] = useState<number>(100); // in kW
  const [stationDetails, setStationDetails] = useState<any>(null);
  const [isSOCDisabled, setIsSOCDisabled] = useState<boolean>(false);
  const [nextReservation, setNextReservation] = useState<{
    date: Date;
    timeString: string;
  } | null>(null);
  let sliderTimeoutId: NodeJS.Timeout;
  const { user } = useUser();
  // Mapping of connector types to icons
  const connectorIcons: Record<ConnectorType, any> = {
    CCS: ccs,
    "Type 2": ccstp2,
    CHAdeMO: chademo,
    GBT: gbt,
  };

  useEffect(() => {
    const loadStationDetails = async () => {
      if (connectorId) {
        try {
          console.log("connectorId", connectorId);
          const details = await fetchConnectorDetails(parseInt(connectorId));
          setStationDetails(details);
          setMaxPower(details.power);
        } catch (error) {
          console.error("Error loading station details:", error);
        }
      }
    };

    loadStationDetails();
  }, [connectorId]);

  useEffect(() => {
    const loadReservations = async () => {
      try {
        if (!connectorId || !stationDetails) return;

        const currentDateTime = new Date();
        const currentTimestamp = currentDateTime.getTime();

        // Check reservations for today and tomorrow
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const todayReservations = await fetchReservations(
          parseInt(connectorId),
          today.toISOString().split("T")[0],
        );
        const tomorrowReservations = await fetchReservations(
          parseInt(connectorId),
          tomorrow.toISOString().split("T")[0],
        );

        let nearestReservation = null;
        let minTimeDiff = Infinity;

        // Check today's reservations
        for (const res of todayReservations) {
          const resDate = new Date(
            `${res.reservation_date}T${res.arrival_time}`,
          );
          const resTimestamp = resDate.getTime();

          if (resTimestamp > currentTimestamp) {
            const timeDiff = resTimestamp - currentTimestamp;
            if (timeDiff < minTimeDiff) {
              minTimeDiff = timeDiff;
              nearestReservation = res;
            }
          }
        }

        // Check tomorrow's reservations
        for (const res of tomorrowReservations) {
          const resDate = new Date(
            `${res.reservation_date}T${res.arrival_time}`,
          );
          const resTimestamp = resDate.getTime();

          const timeDiff = resTimestamp - currentTimestamp;
          if (timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff;
            nearestReservation = res;
          }
        }

        if (nearestReservation) {
          const nearestReservationDate = new Date(
            `${nearestReservation.reservation_date}T${nearestReservation.arrival_time}`,
          );
          const diffInHours =
            (nearestReservationDate.getTime() - currentDateTime.getTime()) /
            (1000 * 60 * 60);

          if (diffInHours > 0 && diffInHours <= 6) {
            const timeString = nearestReservationDate.toLocaleTimeString(
              "en-GB",
              {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              },
            );
            setNextReservation({
              date: nearestReservationDate,
              timeString,
            });
          } else {
            setNextReservation(null);
          }

          const availableTimeMs =
            nearestReservationDate.getTime() -
            currentDateTime.getTime() -
            300000; // 5 minutes buffer
          const calculatedAvailableTime = Math.max(
            0,
            Math.floor(availableTimeMs / 60000),
          );

          // Limit available time to 120 minutes maximum
          const limitedAvailableTime = Math.min(calculatedAvailableTime, 360);
          setAvailableTime(limitedAvailableTime);

          // Calculate maximum power based on available time
          const calculatedMaxPower =
            (stationDetails.power * limitedAvailableTime) / 60;
          setMaxPower(Math.min(calculatedMaxPower, 100)); // Cap at 100kW

          // Check if SOC should be disabled
          if (limitedAvailableTime < 100) {
            setIsSOCDisabled(true);
          }
        } else {
          // Default values if no reservation is found
          setAvailableTime(360);
          setMaxPower(stationDetails.power);
          setIsSOCDisabled(false);
          setNextReservation(null);
        }

        // Reset slider value when available time changes
        setSliderValue(50);
      } catch (error) {
        console.error("Error fetching reservations:", error);
      }
    };

    if (connectorId && stationDetails) {
      loadReservations();
    }
  }, [connectorId, stationDetails]);

  const handleStartCharging = async () => {
    try {
      const result = await startCharging(parsedConnectorId, user.id);
      Alert.alert(
        "Charging Started",
        `Transaction ID: ${result.transactionId}`,
      );

      router.push({
        pathname: "/(root)/(tabs)/charge",
        params: {
          connectorId: parsedConnectorId,
          transactionId: result.transactionId,
        },
      });
    } catch (error) {
      if (error.response && error.response.status === 409) {
        Alert.alert(
          "Charging in Progress",
          "You already have an active charging session.",
        );
      } else {
        Alert.alert("Error", "Failed to start charging");
      }
    }
  };

  const getSliderMaxValue = () => {
    switch (chargingLimit) {
      case "power":
        return maxPower;
      case "time":
        return availableTime;
      case "money":
        return maxPower * 100; // 100〒 per kW
      default:
        return 100;
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

      <View style={styles.stationInfoCard}>
        {stationDetails ? (
          <>
            <Text style={styles.stationName}>
              {stationDetails.location_name} {stationDetails.station_number}
            </Text>
            <Text style={styles.stationStatus}>
              Status: {stationDetails.status}
            </Text>
            <Text style={styles.stationPower}>
              Power: {stationDetails.power} kW
            </Text>

            {/* Connector Icon and Type */}
            <View style={styles.connectorInfo}>
              {stationDetails.connector_type &&
              connectorIcons[stationDetails.connector_type as ConnectorType] ? (
                <Image
                  source={
                    connectorIcons[
                      stationDetails.connector_type as ConnectorType
                    ]
                  }
                  style={styles.connectorIcon}
                />
              ) : (
                <View style={styles.connectorIconPlaceholder} />
              )}
              <Text style={styles.connectorType}>
                {stationDetails.connector_type || "Unknown"}
              </Text>
            </View>
          </>
        ) : (
          <Text>Loading station details...</Text>
        )}

        <Text style={styles.tariff}>Tariff: 100〒/KW</Text>
      </View>

      {/* Display next reservation info if within 6 hours */}
      {nextReservation && (
        <View style={styles.nextReservationInfo}>
          <Text style={styles.nextReservationText}>
            Next reservation is scheduled at {nextReservation.timeString}.
          </Text>
        </View>
      )}

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
            <Image source={lighting} style={styles.iconImage} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.iconButton,
              chargingLimit === "time" && styles.selectedIconButton,
            ]}
            onPress={() => setChargingLimit("time")}
          >
            <Image source={time} style={styles.iconImage} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.iconButton,
              chargingLimit === "money" && styles.selectedIconButton,
            ]}
            onPress={() => setChargingLimit("money")}
          >
            <Image source={tenge} style={styles.iconImage} />
          </TouchableOpacity>
          <TouchableOpacity
            disabled={isSOCDisabled}
            style={[
              styles.iconButton,
              chargingLimit === "soc" && styles.selectedIconButton,
              isSOCDisabled && styles.disabledIconButton,
            ]}
            onPress={() => setChargingLimit("soc")}
          >
            <Image source={battery} style={styles.iconImage} />
          </TouchableOpacity>
        </View>

        {chargingLimit !== "unplanned" && (
          <View style={styles.sliderContainer}>
            {chargingLimit === "power" && (
              <>
                <Text style={styles.sliderLabel}>
                  Power (kW): {Math.min(Math.round(sliderValue), maxPower)}
                </Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={maxPower}
                  step={1}
                  value={Math.min(sliderValue, maxPower)}
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
                  Duration (minutes):{" "}
                  {Math.min(Math.round(sliderValue), availableTime)}
                </Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={availableTime}
                  step={1}
                  value={Math.min(sliderValue, availableTime)}
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
                  Amount:{" "}
                  {Math.min(Math.round(sliderValue), maxPower * 100).toFixed(2)}
                  〒
                </Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={maxPower * 100}
                  step={1}
                  value={Math.min(sliderValue, maxPower * 100)}
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
                  style={styles.slider}
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

      <TouchableOpacity style={styles.button} onPress={handleStartCharging}>
        <Text style={styles.buttonText}>Start Charging</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 10, // Reduced padding
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15, // Reduced margin
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
  stationInfoCard: {
    backgroundColor: "#fff",
    padding: 20, // Reduced padding
    borderRadius: 15,
    marginBottom: 15, // Reduced margin
    alignItems: "center",
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  stationName: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#222",
  },
  stationLocation: {
    fontSize: 18,
    color: "#555",
    marginBottom: 12,
  },
  stationStatus: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
  },
  stationPower: {
    fontSize: 16,
    color: "#333",
    marginBottom: 20,
  },
  connectorInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },
  connectorIcon: {
    width: 60,
    height: 60,
    marginRight: 10,
  },
  connectorIconPlaceholder: {
    width: 40,
    height: 40,
    marginRight: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  connectorType: {
    fontSize: 18,
    color: "#333",
  },
  tariff: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#222",
    marginTop: 10,
  },
  chargingLimitSection: {
    backgroundColor: "#fff",
    padding: 20, // Reduced padding
    borderRadius: 15,
    marginBottom: 15, // Reduced margin
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#222",
  },
  iconButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f0f0f0",
    borderRadius: 50,
    padding: 15,
    marginBottom: 25,
  },
  iconButton: {
    padding: 15,
    borderRadius: 50,
    alignItems: "center",
    width: 60,
    height: 60,
    justifyContent: "center",
  },
  selectedIconButton: {
    backgroundColor: "#4C86AF",
  },
  disabledIconButton: {
    backgroundColor: "#cccccc",
  },
  iconImage: {
    width: 30,
    height: 30,
  },
  sliderContainer: {
    marginTop: 15,
  },
  sliderLabel: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#222",
  },
  slider: {
    width: "100%",
    height: 50,
  },
  button: {
    backgroundColor: "#4c86af",
    padding: 15, // Reduced padding
    borderRadius: 12,
    alignItems: "center",
    marginTop: 15, // Reduced margin
    elevation: 5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 19,
  },
  unplannedContainer: {
    marginTop: 25,
    padding: 20,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
  },
  unplannedText: {
    fontSize: 17,
    color: "#666",
    textAlign: "center",
  },
  nextReservationInfo: {
    backgroundColor: "#fff8dc",
    padding: 15,
    borderRadius: 10,
    marginVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffd700",
  },
  nextReservationText: {
    color: "#8b4513",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default ChargeStart;
