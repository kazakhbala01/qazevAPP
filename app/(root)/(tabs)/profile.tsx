import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@/contexts/UserContext";
import { fetchAPI } from "@/lib/fetch";
import { router } from "expo-router";
import Icon from "react-native-vector-icons/Ionicons";

const Profile = () => {
  const { user, setUser } = useUser();
  const [balance, setBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = () => {
    setUser(null);
    router.replace("/(auth)/sign-in");
  };

  const fetchBalance = async () => {
    if (user) {
      try {
        const response = await fetchAPI(`/user-balance/${user.id}`, {
          method: "GET",
        });

        if (response.balance) {
          setBalance(response.balance);
        }
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBalance();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#4CAF50"]}
            tintColor={"#4CAF50"}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          {user && (
            <>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.email}>{user.email}</Text>
            </>
          )}
        </View>

        {/* Balance Card */}
        <View style={styles.accountBalanceContainer}>
          <View style={styles.balanceContent}>
            <Text style={styles.accountText}>Balance</Text>
            <Text style={styles.balanceText}>{balance}〒</Text>
          </View>
          <TouchableOpacity
            style={styles.topUpButton}
            onPress={() => router.push("/(root)/(activities)/TopUp")}
          >
            <Text style={styles.topUpButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Information Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Information</Text>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => router.push("/(root)/(activities)/ChargeHistory")}
          >
            <Icon name="receipt-outline" size={20} color="#4CAF50" />
            <Text style={styles.optionText}>Charge History</Text>
            <Icon name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Settings Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <TouchableOpacity
            style={[styles.optionRow, styles.logoutRow]}
            onPress={handleLogout}
          >
            <Icon name="log-out-outline" size={20} color="#fc2727" />
            <Text style={styles.logoutText}>Logout</Text>
            <Icon name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  content: {
    flexGrow: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F5F5",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  balanceContent: {
    flex: 1,
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
  topUpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  topUpButtonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  optionText: {
    fontSize: 16,
    marginLeft: 10,
    color: "#333",
  },
  logoutRow: {
    borderBottomWidth: 0,
  },
  logoutText: {
    fontSize: 16,
    marginLeft: 10,
    color: "#fc2727",
  },
});
