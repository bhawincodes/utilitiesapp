import React, { useEffect } from "react";
import axios from "axios";

function AuthCallback() {
  useEffect(async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token"); // from /auth/google/callback redirect
    if (token) {
      localStorage.setItem("token", token);
      window.location.replace("/");
    } else {
      // if you instead use fragment (#token=...), parse location.hash
      console.error("No token in URL");
    }
  }, []);

  return <p>Finishing login...</p>;
}

export default AuthCallback;
