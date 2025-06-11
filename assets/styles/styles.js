import { StyleSheet } from "react-native";
import { Dimensions } from "react-native";

const { height: screenHeight } = Dimensions.get("window");

export const styles = StyleSheet.create({
  // General Layout Styles
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 1000,
  },
  error: {
    color: "red",
    textAlign: "center",
    margin: 20,
    fontSize: 16,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
  },
  retryButton: {
    color: "#007BFF",
    marginTop: 10,
    textDecorationLine: "underline",
    fontWeight: "bold",
  },
  stationDetailsContainer: {
    flex: 2, // Take 75% of the width
    marginRight: 15, // Add space between text and icons
  },
  connectorIconsContainer: {
    flex: 1, // Take 25% of the width
    justifyContent: "flex-end", // Align icons to the end (right side)
    alignItems: "center", // Center icons vertically
    flexDirection: "row", // Display icons in a row
  },
  connectorIcons: {
    width: 40,
    height: 40,
    marginRight: 15,
  },
  stationDetails: {
    flex: 1,
    justifyContent: "center", // Vertically center the text
  },
  // Map Markers
  userMarker: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: "#00BFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "white",
  },
  userMarkerInner: {
    height: 18,
    width: 18,
    borderRadius: 9,
    backgroundColor: "white",
  },
  stationMarker: {
    height: 28,
    width: 28,
    borderRadius: 14,
    borderWidth: 3,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  stationPower: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#000",
    textAlign: "center",
  },
  calloutContainer: {
    width: 200,
    padding: 10,
    backgroundColor: "white",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
    elevation: 5,
  },
  calloutContent: {
    maxWidth: 200,
    padding: 5,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },

  // Modal Styles
  modalOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "47%",
    backgroundColor: "rgba(0, 0, 0, 0)",
  },
  card: {
    width: "100%",
    height: "100%",
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    position: "absolute",
    bottom: 0,
    overflow: "hidden",
  },
  closeIcon: {
    position: "absolute",
    top: 10,
    right: 15,
    zIndex: 10,
  },
  closeIconText: {
    fontSize: 24,
    color: "#555",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "center", // Center the title
  },
  cardDetails: {
    fontSize: 16,
    marginBottom: 4,
    textAlign: "center", // Center the title
  },
  detailsText: {
    fontSize: 16,
    marginBottom: 15,
    color: "#333",
    textAlign: "center", // Center the details
  },
  connectorsContainer: {
    flexDirection: "row",
    justifyContent: "center", // Center the cards
    alignItems: "center", // Align vertically
    marginBottom: 15,
    flexWrap: "wrap", // Allow cards to wrap on smaller screens
  },
  connectorCard: {
    width: 150, // Fixed width
    height: 150, // Fixed height to make it square
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 15,
    margin: 4, // Increased space between cards
    marginBottom: 10,
    backgroundColor: "#f9f9f9", // Light background for better visibility
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedConnector: {
    borderColor: "#007BFF", // Blue border for selected connector
    borderWidth: 2,
  },
  connectorType: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
  },
  connectorPower: {
    fontSize: 14,
    marginBottom: 5,
  },
  connectorStatus: {
    fontSize: 14,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around", // Space buttons apart
    marginTop: 10,
    width: "100%", // Take full width
  },
  connectButton: {
    backgroundColor: "#007BFF",
    padding: 12,
    borderRadius: 8,
    width: "45%", // Adjusted width to take more space
    alignItems: "center",
  },
  reserveButton: {
    backgroundColor: "#007BFF",
    padding: 12,
    borderRadius: 8,
    width: "45%", // Adjusted width to take more space
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  reservationListTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
  },
  calendarContainer: {
    marginTop: 10,
  },
  calendarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calendarHour: {
    width: 30,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f9f9f9",
  },
  reservedHour: {
    backgroundColor: "#ffcccc",
  },
  selectTimeButton: {
    backgroundColor: "#007BFF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: "center",
  },
  submitButton: {
    backgroundColor: "#007BFF",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  // Station and Connector Styles
  stationCard: {
    flexDirection: "row", // Use row layout
    padding: 15,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    alignItems: "center", // Vertically center content
  },
  selectedStation: {
    borderColor: "#007BFF",
    borderWidth: 2,
  },
  scrollContainer: {
    maxHeight: 300,
  },
  capacityText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  connectorIcon: {
    width: 60,
    height: 60,
  },
});
