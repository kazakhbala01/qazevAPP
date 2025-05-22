import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@/contexts/UserContext";
const photo = "@/assets/icons/charge_green.png";
const Profile = () => {
  const { user } = useUser();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {user && (
            <>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.email}>{user.email}</Text>
            </>
          )}
        </View>

        <View style={styles.accountBalanceContainer}>
          <Text style={styles.accountText}>Мой счет</Text>
          <Text style={styles.balanceText}>0₸</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.infoLabel}>Полученные сссылки</Text>
          <TouchableOpacity style={styles.infoButton}>
            <Text style={styles.infoButtonText}>История зарядок</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.infoButton}>
            <Text style={styles.infoButtonText}>Активировать промокод</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.infoButton}>
            <Text style={styles.infoButtonText}>Помощь</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingsContainer}>
          <Text style={styles.settingsLabel}>Настройки</Text>
          <TouchableOpacity style={styles.settingsButton}>
            <Text style={styles.settingsButtonText}>Профиль</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    overflow: "hidden",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
  },
  email: {
    fontSize: 16,
    color: "#666",
  },
  accountBalanceContainer: {
    backgroundColor: "#F5F5F5F5",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  accountText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 5,
  },
  balanceText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#666",
  },
  discountContainer: {
    backgroundColor: "#f5f5f5f5",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  discountText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 5,
  },
  discountValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  infoContainer: {
    marginBottom: 30,
  },
  infoLabel: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  infoButton: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 10,
  },
  infoButtonText: {
    fontSize: 16,
    color: "#4CAF50",
  },
  settingsContainer: {
    marginBottom: 30,
  },
  settingsLabel: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  settingsButton: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignItems: "center",
  },
  settingsButtonText: {
    fontSize: 16,
    color: "#4CAF50",
  },
});

export default Profile;
