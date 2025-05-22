import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Alert,
  Image,
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import {
  useStationsData,
  getMarkerColor,
  LocationData,
  Station,
} from "@/lib/fetch";
import { router } from "expo-router";
import { styles } from "@/assets/styles/styles";
import { useUser } from "@/contexts/UserContext";

const { height: screenHeight } = Dimensions.get("window");

// Define connector icons
type ConnectorType = "CCS" | "Type 2" | "CHAdeMO" | "GBT";
const connectorIcons: Record<ConnectorType, string> = {
  CCS: require("@/assets/icons/ccs.png"),
  "Type 2": require("@/assets/icons/ccstp2.png"),
  CHAdeMO: require("@/assets/icons/chademo.png"),
  GBT: require("@/assets/icons/gbt.png"),
};

const Home = () => {
  const { locations, location, error, refetch } = useStationsData();
  const mapRef = useRef<MapView | null>(null);

  // State variables
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    null,
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(
    null,
  );
  const [selectedConnectorId, setSelectedConnectorId] = useState<number | null>(
    null,
  );
  const { user } = useUser();

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const intervalId = setInterval(refetch, 30000);
    return () => clearInterval(intervalId);
  }, [refetch]);

  const defaultRegion = {
    latitude: 51.1655,
    longitude: 71.4272,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  // Handle marker press
  const handleMarkerPress = (location: LocationData) => {
    setSelectedLocation(location);
    if (location.stations.length === 1) {
      setSelectedStationId(location.stations[0].id);
    } else {
      setSelectedStationId(null);
    }

    setSelectedConnectorId(null);
    setModalVisible(true);
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        },
        1000,
      );
    }
  };

  const handleConnectPress = () => {
    if (!selectedConnectorId || !user) {
      Alert.alert("Error", "Please log in.");
      return;
    }
    const idTag = user.id.toString(); // Use the logged-in user's ID as the idTag
    router.push({
      pathname: "/(root)/(activities)/chargeStart",
      params: {
        connectorId: selectedConnectorId,
        idTag, // Pass the actual user ID
      },
    });
  };

  // Navigate to reservation screen
  const handleReservePress = () => {
    setModalVisible(false);
    if (!selectedConnectorId || !user) {
      Alert.alert("Attention", "Please log in first.");
      return;
    }
    if (selectedConnectorId) {
      router.push(
        `/(root)/(activities)/reservation/${String(selectedConnectorId)}`,
      );
    }
  };

  // Render station cards
  const renderStationCards = () => (
    <ScrollView style={styles.scrollContainer}>
      {selectedLocation?.stations.map((station) => (
        <TouchableOpacity
          key={station.id}
          onPress={() => setSelectedStationId(station.id)}
        >
          <View style={styles.stationCard}>
            {/* Station Details Container */}
            <View style={styles.stationDetailsContainer}>
              <Text>{station.station_number}</Text>
              <Text>
                Status:{" "}
                <Text
                  style={{
                    color:
                      station.status === "available"
                        ? "#2ecc71" // Light green for available
                        : "#e74c3c", // Red for other statuses
                  }}
                >
                  {station.status}
                </Text>
              </Text>
            </View>

            {/* Connector Icons Container */}
            <View style={styles.connectorIconsContainer}>
              {station.connectors.map((connector) => (
                <Image
                  key={connector.id}
                  source={
                    connectorIcons[connector.connector_type] ||
                    require("@/assets/icons/ccs.png")
                  }
                  style={styles.connectorIcon}
                />
              ))}
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // Render connectors and buttons
  const renderConnectors = () => {
    const selectedStation = selectedLocation?.stations.find(
      (station) => station.id === selectedStationId,
    );
    if (!selectedStation) return null;

    return (
      <View>
        <View style={styles.connectorsContainer}>
          {selectedStation.connectors.map((connector) => (
            <TouchableOpacity
              key={connector.id}
              onPress={() => setSelectedConnectorId(connector.id)}
            >
              <View
                style={[
                  styles.connectorCard,
                  selectedConnectorId === connector.id
                    ? styles.selectedConnector
                    : {},
                ]}
              >
                <Image
                  source={
                    connectorIcons[connector.connector_type as ConnectorType]
                  }
                  style={styles.connectorIcon}
                />
                <Text>Type: {connector.connector_type}</Text>
                <Text>Power: {connector.power} kW</Text>
                <Text>
                  Status:{" "}
                  <Text
                    style={{
                      color:
                        connector.status === "available"
                          ? "#00b447" // Light green for available
                          : "#e74c3c", // Red for other statuses
                    }}
                  >
                    {connector.status}
                  </Text>
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.connectButton}
            disabled={!selectedConnectorId}
            onPress={handleConnectPress}
          >
            <Text style={styles.buttonText}>Connect</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reserveButton}
            disabled={!selectedConnectorId}
            onPress={handleReservePress}
          >
            <Text style={styles.buttonText}>Reserve</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={defaultRegion}
        showsUserLocation
      >
        {/* Current User Location Marker */}
        {location && (
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="You are here"
            description="Current Location"
          >
            <View style={styles.userMarker}>
              <View style={styles.userMarkerInner} />
            </View>
          </Marker>
        )}

        {/* Locations Markers */}
        {locations?.map((loc) =>
          loc.stations.map((station) => (
            <Marker
              key={`${loc.id}-${station.id}`}
              coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
              onPress={() => handleMarkerPress(loc)}
            >
              <View
                style={[
                  styles.stationMarker,
                  {
                    borderColor:
                      selectedLocation?.id === loc.id
                        ? "#1e88e5"
                        : getMarkerColor(station.status),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stationPower,
                    { textAlign: "center" },
                    loc.capacity > 1 && styles.capacityText,
                  ]}
                >
                  {loc.capacity > 1
                    ? loc.capacity
                    : `${station.connectors[0]?.power || 0} kW`}
                </Text>
              </View>
            </Marker>
          )),
        )}
      </MapView>

      {/* Error Overlay */}
      {error && (
        <View style={styles.overlayContainer}>
          <Text style={styles.error}>{error}</Text>
          <Text onPress={refetch} style={styles.retryButton}>
            Retry
          </Text>
        </View>
      )}

      {/* Modal for Station Details */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          setSelectedLocation(null); // Reset selected location
        }}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <ScrollView contentContainerStyle={styles.card}>
                {selectedLocation && (
                  <>
                    <TouchableOpacity
                      style={styles.closeIcon}
                      onPress={() => {
                        setModalVisible(false);
                        setSelectedLocation(null);
                      }}
                    >
                      <Text style={styles.closeIconText}>×</Text>
                    </TouchableOpacity>
                    <Text style={styles.cardTitle}>
                      {selectedLocation.name}
                    </Text>
                    <Text style={styles.cardDetails}>
                      {" "}
                      Details: {selectedLocation.details}
                    </Text>

                    {!selectedStationId
                      ? renderStationCards()
                      : renderConnectors()}
                  </>
                )}
              </ScrollView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default Home;
