// SignIn.tsx
import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { Link, router } from "expo-router";
import { fetchAPI } from "@/lib/fetch";
import InputField from "@/components/InputField";
import CustomButton from "@/components/CustomButton";
import { icons } from "@/constants";

const SignIn = () => {
  const { storeToken } = useAuth();
  const { setUser } = useUser();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    email: "",
    password: "",
  });

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Password validation regex (at least 8 characters, including letters and numbers)
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

  const validateForm = () => {
    let hasErrors = false;
    const newErrors = { email: "", password: "" };

    if (!emailRegex.test(form.email)) {
      newErrors.email = "Please enter a valid email address";
      hasErrors = true;
    }

    if (!passwordRegex.test(form.password)) {
      newErrors.password =
        "Password must be at least 8 characters with letters and numbers";
      hasErrors = true;
    }

    setErrors(newErrors);
    return !hasErrors;
  };

  const onSignInPress = async () => {
    if (!validateForm()) return;
    setLoading(true);
    const { email, password } = form;
    try {
      const response = await fetchAPI("/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.token && response.user) {
        await storeToken(response.token);
        setUser(response.user);
        router.push(`/(root)/(tabs)/home`);
      } else {
        Alert.alert("Login Error", response.error || "Invalid credentials");
      }
    } catch (error) {
      console.error("Sign-in error:", error);
      Alert.alert("Login Error", "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 bg-white">
        <View className="relative w-full h-[190px]">
          <Text className="text-black text-4xl font-JakartaExtraBold absolute bottom-5 left-5">
            Hi, Welcome👋
          </Text>
        </View>
        <View className="p-5">
          <InputField
            label="  Email"
            placeholder="Enter your email"
            icon={icons.email}
            value={form.email}
            onChangeText={(value) => setForm({ ...form, email: value })}
            error={errors.email}
          />
          <Text className="text-red-500 text-xs mt-1">{errors.email}</Text>

          <InputField
            label="  Password"
            placeholder="Enter your Password"
            icon={icons.lock}
            secureTextEntry={true}
            value={form.password}
            onChangeText={(value) => setForm({ ...form, password: value })}
            error={errors.password}
          />
          <Text className="text-red-500 text-xs mt-1">{errors.password}</Text>

          <CustomButton
            title="Sign In"
            onPress={onSignInPress}
            loading={loading}
            className="mt-6"
          />
          <Link
            href="/sign-up"
            className="text-lg text-center text-general-200 mt-10"
          >
            <Text>Don't have an account? </Text>
            <Text className="text-primary-500">Sign Up</Text>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
};

export default SignIn;
