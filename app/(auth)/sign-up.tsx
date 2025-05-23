// SignUp.tsx
import { useState } from "react";
import { View, Text, ScrollView, Alert, Image } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { Link, router } from "expo-router";
import { fetchAPI } from "@/lib/fetch";
import InputField from "@/components/InputField";
import CustomButton from "@/components/CustomButton";
import { icons, images } from "@/constants";
import { ReactNativeModal } from "react-native-modal";

const SignUp = () => {
  const { storeToken } = useAuth();
  const { setUser } = useUser();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
  });

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Password validation regex (at least 8 characters, including letters and numbers)
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

  const validateForm = () => {
    let hasErrors = false;
    const newErrors = { name: "", email: "", password: "" };

    if (!form.name.trim()) {
      newErrors.name = "Name is required";
      hasErrors = true;
    }

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

  const onSignUpPress = async () => {
    if (!validateForm()) return;

    try {
      const response = await fetchAPI("/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (response.token && response.user) {
        await storeToken(response.token);
        setUser(response.user);
        setShowSuccessModal(true);
      } else {
        Alert.alert("Signup Error", response.error || "Signup failed");
      }
    } catch (error) {
      console.error("Sign-up error:", error);
      Alert.alert("Signup Error", "Something went wrong. Please try again.");
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 bg-white">
        <View className="relative w-full h-[190px]">
          <Text className="text-black text-4xl font-JakartaExtraBold absolute bottom-5 left-5">
            Create account
          </Text>
        </View>
        <View className="p-5">
          <InputField
            label="  Username"
            placeholder="Enter name"
            icon={icons.person}
            value={form.name}
            onChangeText={(value) => setForm({ ...form, name: value })}
            error={errors.name}
          />
          <Text className="text-red-500 text-xs mt-1">{errors.name}</Text>

          <InputField
            label="  Email"
            placeholder="Enter email"
            icon={icons.email}
            textContentType="emailAddress"
            value={form.email}
            onChangeText={(value) => setForm({ ...form, email: value })}
            error={errors.email}
          />
          <Text className="text-red-500 text-xs mt-1">{errors.email}</Text>

          <InputField
            label="  Password"
            placeholder="Enter password"
            icon={icons.lock}
            secureTextEntry={true}
            textContentType="password"
            value={form.password}
            onChangeText={(value) => setForm({ ...form, password: value })}
            error={errors.password}
          />
          <Text className="text-red-500 text-xs mt-1">{errors.password}</Text>

          <CustomButton
            title="Sign Up"
            onPress={onSignUpPress}
            className="mt-6"
          />
          <Link
            href="/sign-in"
            className="text-lg text-center text-general-200 mt-10"
          >
            Already have an account?{" "}
            <Text className="text-primary-500">Log In</Text>
          </Link>
        </View>
        <ReactNativeModal isVisible={showSuccessModal}>
          <View className="bg-white px-7 py-9 rounded-2xl min-h-[300px]">
            <Image
              source={images.check}
              className="w-[110px] h-[110px] mx-auto my-5"
            />
            <Text className="text-3xl font-JakartaBold text-center">
              Account Created
            </Text>
            <Text className="text-base text-gray-400 font-Jakarta text-center mt-2">
              Welcome to the platform!
            </Text>
            <CustomButton
              title="Browse Home"
              onPress={() => router.push(`/(root)/(tabs)/home`)}
              className="mt-5"
            />
          </View>
        </ReactNativeModal>
      </View>
    </ScrollView>
  );
};

export default SignUp;
