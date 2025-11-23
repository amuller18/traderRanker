"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('auth_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    // Simulate API call
    // In production, this would call your authentication API
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const storedUsers = localStorage.getItem('registered_users');
        const users = storedUsers ? JSON.parse(storedUsers) : [];

        const foundUser = users.find(
          (u: any) => u.email === email && u.password === password
        );

        if (foundUser) {
          const userData: User = {
            id: foundUser.id,
            email: foundUser.email,
            username: foundUser.username,
          };
          setUser(userData);
          localStorage.setItem('auth_user', JSON.stringify(userData));
          resolve();
        } else {
          reject(new Error('Invalid email or password'));
        }
      }, 500);
    });
  };

  const register = async (
    email: string,
    username: string,
    password: string
  ): Promise<void> => {
    // Simulate API call
    // In production, this would call your registration API
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const storedUsers = localStorage.getItem('registered_users');
        const users = storedUsers ? JSON.parse(storedUsers) : [];

        // Check if user already exists
        const existingUser = users.find((u: any) => u.email === email);
        if (existingUser) {
          reject(new Error('User with this email already exists'));
          return;
        }

        const newUser = {
          id: `user_${Date.now()}`,
          email,
          username,
          password, // In production, this should be hashed on the backend
        };

        users.push(newUser);
        localStorage.setItem('registered_users', JSON.stringify(users));

        const userData: User = {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
        };
        setUser(userData);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        resolve();
      }, 500);
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
