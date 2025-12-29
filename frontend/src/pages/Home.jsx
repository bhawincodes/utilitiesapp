import React from 'react'
import axios from "axios";

export default function Home() {

  const handleGoogleLogin = async () => {
    const res = await axios.get("http://localhost:8000/auth/google/url");
    window.location.href = res.data.url;
  };

  // somewhere in App.js
  const fetchProfile = async () => {
    const token = localStorage.getItem("token");
    const res = await axios.get("http://localhost:8000/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(res.data);
  };


  return (
    <div>
        <h1>Login</h1>
        <button onClick={handleGoogleLogin}>Sign in with Google</button>
    </div>
  )
}
