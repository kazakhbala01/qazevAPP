import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
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

const { height: screenHeight } = Dimensions.get("window");

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
    setSelectedStationId(null);
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

  // Show charging form when Connect is pressed
  const handleConnectPress = () => {
    if (!selectedConnectorId) return;
    router.push({
      pathname: "/charge",
      params: {
        connectorId: selectedConnectorId,
        idTag: "user_123",
      },
    });
  };

  // Navigate to reservation screen
  const handleReservePress = () => {
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
          <View
            style={[
              styles.stationCard,
              selectedStationId === station.id ? styles.selectedStation : {},
            ]}
          >
            <Text>Station: {station.station_number}</Text>
            <Text>Status: {station.status}</Text>
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
                <Text>Type: {connector.connector_type}</Text>
                <Text>Power: {connector.power} kW</Text>
                <Text>Status: {connector.status}</Text>
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
                  { borderColor: getMarkerColor(station.status) },
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
                    : `${station.connectors[0]?.power || 0} kW`}{" "}
                </Text>
              </View>
              <Callout tooltip={true}></Callout>
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
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <ScrollView contentContainerStyle={styles.card}>
                {selectedLocation && (
                  <>
                    <TouchableOpacity
                      style={styles.closeIcon}
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={styles.closeIconText}>×</Text>
                    </TouchableOpacity>
                    <Text style={styles.cardTitle}>
                      {selectedLocation.name}
                    </Text>
                    <Text>Details: {selectedLocation.details}</Text>

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
