import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";

// Type definitions remain unchanged
export type Connector = {
  id: number;
  connector_type: string;
  power: number;
  status: string;
};

export type Station = {
  id: number;
  station_number: string;
  status: string;
  connectors: Connector[];
};

export type LocationData = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  details: string | null;
  stations: Station[];
  capacity: number; // Add this line
};

export type LocationCoords = {
  latitude: number;
  longitude: number;
};

// Base URL for the Express.js backend
const BASE_URL = "http://192.168.1.71:5000/api"; // Replace with your backend URL

export const fetchAPI = async (url: string, options: RequestInit = {}) => {
  const fullUrl = `${BASE_URL}${url.startsWith("/") ? url : "/" + url}`;
  try {
    const response = await fetch(fullUrl, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  } catch (error) {
    console.error("API error:", error);
    throw error;
  }
};

// Fetch locations with nested stations and connectors
export const fetchLocations = async (): Promise<LocationData[]> => {
  try {
    const response = await fetch(`${BASE_URL}/locations`);
    if (!response.ok) throw new Error("Failed to fetch locations");
    const data = await response.json();
    return data?.filter(isValidLocation) || [];
  } catch (error) {
    console.error("Error fetching locations:", error);
    throw error;
  }
};

// Start charging via backend API
// Fetch user's current location
export const fetchUserLocation = async (): Promise<LocationCoords | null> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("Location permission denied");
      return null;
    }
    const { coords } = await Location.getCurrentPositionAsync({});
    return { latitude: coords.latitude, longitude: coords.longitude };
  } catch (error) {
    console.error("Error fetching user location:", error);
    return null;
  }
};

export const startTransaction = async (connectorId: number, userId: number) => {
  try {
    const transactionId = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const response = await fetch(`${BASE_URL}/start-transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectorId, userId, transactionId }),
    });
    if (!response.ok) throw new Error("Failed to start transaction");
    return await response.json();
  } catch (error) {
    console.error("Error starting transaction:", error);
    throw error;
  }
};

export const stopTransaction = async (transactionId: string) => {
  try {
    const response = await fetch(`${BASE_URL}/stop-transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    });
    if (!response.ok) throw new Error("Failed to stop transaction");
    return await response.json();
  } catch (error) {
    console.error("Error stopping transaction:", error);
    throw error;
  }
};

// Hook to manage fetching and state for locations and user location
export const useStationsData = () => {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedLocations, fetchedLocation] = await Promise.all([
        fetchLocations(),
        fetchUserLocation(),
      ]);
      setLocations(fetchedLocations);
      setLocation(fetchedLocation);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error("Data fetch error:", errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    locations,
    location,
    loading,
    error,
    refetch: fetchData,
  };
};

// Utility functions for validation
export const isValidLocation = (location: any): location is LocationData => {
  return (
    location &&
    typeof location.id === "number" &&
    typeof location.latitude === "number" &&
    typeof location.longitude === "number" &&
    typeof location.name === "string" &&
    Array.isArray(location.stations) &&
    location.stations.every(isValidStation)
  );
};

export const isValidStation = (station: any): station is Station => {
  return (
    station &&
    typeof station.id === "number" &&
    typeof station.station_number === "string" &&
    typeof station.status === "string" &&
    Array.isArray(station.connectors) &&
    station.connectors.every(isValidConnector)
  );
};

export const isValidConnector = (connector: any): connector is Connector => {
  return (
    connector &&
    typeof connector.id === "number" &&
    typeof connector.connector_type === "string" &&
    typeof connector.power === "number" &&
    typeof connector.status === "string"
  );
};

// Utility function to get marker color based on station status
export const getMarkerColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "available":
      return "green";
    case "in use":
      return "orange";
    case "out of service":
      return "red";
    default:
      return "gray";
  }
};

// Fetch reservations for a specific connector
// @/lib/fetch.ts
// @/lib/fetch.ts
export interface Reservation {
  reservation_date: any;
  id: number;
  connector_id: number;
  arrival_time: string;
  duration: number;
}

export const fetchReservations = async (
  connectorId: number,
  date?: string, // Format: YYYY-MM-DD
): Promise<Reservation[]> => {
  try {
    let url = `${BASE_URL}/reservations/connector/${connectorId}`;
    if (date) {
      url += `?date=${date}`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch reservations");
    return await response.json();
  } catch (error) {
    console.error("Error fetching reservations:", error);
    throw error;
  }
};

export const fetchConnectorDetails = async (connectorId: number) => {
  try {
    const response = await fetch(`${BASE_URL}/connectors/${connectorId}`);
    if (!response.ok) throw new Error("Failed to fetch connector details");
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching connector details:", error);
    throw error;
  }
};

export const createReservation = async (reservation: {
  connector_id: number;
  arrival_time: string;
  duration: number;
  user_id: number;
  reservation_date: string; // Include reservation_date
}): Promise<Reservation> => {
  try {
    const response = await fetch(`${BASE_URL}/reservations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reservation),
    });
    if (!response.ok) {
      throw new Error("Failed to create reservation");
    }
    return await response.json();
  } catch (error) {
    console.error("Error creating reservation:", error);
    throw error;
  }
};

export const startChargingSession = async (
  connectorId: number,
  userId: number,
) => {
  try {
    const response = await fetch(`${BASE_URL}/start-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectorId, userId }),
    });
    if (!response.ok) throw new Error("Failed to start charging session");
    return await response.json();
  } catch (error) {
    console.error("Error starting charging session:", error);
    throw error;
  }
};

// Stop the current charging session
export const stopChargingSession = async (transactionId: string) => {
  try {
    const response = await fetch(`${BASE_URL}/stop-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    });
    if (!response.ok) throw new Error("Failed to stop charging session");
    return await response.json();
  } catch (error) {
    console.error("Error stopping charging session:", error);
    throw error;
  }
};

export const fetchActiveSession = async (connectorId: number) => {
  try {
    const response = await fetch(`${BASE_URL}/active-session/${connectorId}`);
    if (!response.ok) throw new Error("Failed to fetch active session");
    return await response.json();
  } catch (error) {
    console.error("Error fetching active session:", error);
    throw error;
  }
};
