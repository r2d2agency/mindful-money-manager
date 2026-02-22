import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@/types";
import { getStoredUser, isAuthenticated, logout } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isLoggedIn: boolean;
  setUser: (user: User | null) => void;
  handleLogout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isLoggedIn: false,
  setUser: () => {},
  handleLogout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser);

  useEffect(() => {
    if (!isAuthenticated()) setUser(null);
  }, []);

  const isAdmin = user?.role === "admin";
  const isLoggedIn = !!user && isAuthenticated();

  function handleLogout() {
    setUser(null);
    logout();
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoggedIn, setUser, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
