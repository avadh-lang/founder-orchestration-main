"use client";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0a0a0f",
    }}>
      <SignIn
        appearance={{
          variables: {
            colorBackground: "#12121a",
            colorText: "#e8e8f0",
            colorPrimary: "#6366f1",
          }
        }}
      />
    </div>
  );
}
