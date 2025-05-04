// contexts/UserContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: number;
  name: string;
  email: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const UserContext = createContext<UserContextType | undefined>(
  undefined,
);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    console.log("UserContext updated. Current user:", user); // Add this line
  }, [user]);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
