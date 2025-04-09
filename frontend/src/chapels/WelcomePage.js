import React from "react";
import { Link } from "react-router-dom";

const WelcomePage = () => {
  return (
    <div
      style={{
        position: "absolute",              // 🔧 fills entire screen
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "linear-gradient(135deg, #0f0f23 0%, #1b1b2f 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#f4f4f5",
        fontFamily: "'Inter', sans-serif",
        textAlign: "center",
        padding: "2rem",
        zIndex: 0,
      }}
    >
      <h1
        style={{
          fontFamily: "'Cinzel', serif",
          fontSize: "2.8rem",
          fontWeight: "700",
          marginBottom: "0.3rem",
          color: "#ffffff",
        }}
      >
        Legio Fidelis
      </h1>

      <p
        style={{
          fontSize: "1.1rem",
          color: "#9ca3af",
          marginBottom: "2rem",
        }}
      >
        A Global Mission for 24/7 Eucharistic Adoration
      </p>

      <p
        style={{
          fontSize: "1.2rem",
          maxWidth: "600px",
          color: "#cbd5e1",
          marginBottom: "2.5rem",
        }}
      >
        Choose an adoration chapel to continue. Experience perpetual prayer
      </p>

      <Link
        to="/jerusalem"
        style={{
          background: "linear-gradient(90deg, #6b21a8 0%, #8b5cf6 100%)",
          color: "#fff",
          fontWeight: "600",
          fontSize: "1rem",
          padding: "0.9rem 2rem",
          borderRadius: "8px",
          textDecoration: "none",
          boxShadow: "0 0 10px rgba(139, 92, 246, 0.6)",
          transition: "transform 0.2s ease",
        }}
        onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
      >
        24/7 Jerusalem
      </Link>
    </div>
  );
};

export default WelcomePage;
