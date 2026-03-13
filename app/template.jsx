"use client";

import { AppProvider } from "@/context/AppContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Toast from "@/components/Toast";

export default function Template({ children }) {
  return (
    <AppProvider>
      <Header />
      <Toast />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {children}
      </main>
      <Footer />
    </AppProvider>
  );
}
